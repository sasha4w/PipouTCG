import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  GameState,
  GameEndReason,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
  drawCard,
} from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';
import { EffectTrigger } from '../../cards/interfaces/card-effect.interface';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';

const HAND_LIMIT = 7;

@Injectable()
export class PhaseService {
  constructor(
    private effectsResolver: EffectsResolverService,
    private buffsCalc: BuffsCalculatorService,
  ) {}

  async endPhase(
    game: GameState,
    userId: number,
    server: Server,
    onEndGame: (
      game: GameState,
      winnerId: number,
      reason: GameEndReason,
      server: Server,
    ) => Promise<void>,
    onTurnEnd: (game: GameState, server: Server) => void,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    switch (game.phase) {
      case 'main':
        game.phase = 'battle';
        addLog(game, `${player.username} → phase de combat`);
        break;

      case 'battle':
        game.phase = 'end';
        break;

      case 'end': {
        const surplus = player.hand.length - HAND_LIMIT;
        if (surplus > 0) {
          return { error: `Défaussez ${surplus} carte(s) avant de terminer` };
        }
        for (const z of player.monsterZones) {
          if (!z) continue;
          z.hasAttackedThisTurn = false;
          z.attacksUsedThisTurn = 0;
          z.tempAtkBuff = 0;
          z.summonedThisTurn = false;
          if (z.doubleAtkNextTurn) {
            z.attacksPerTurn = 2;
            z.doubleAtkNextTurn = false;
          }
        }
        player.recycleEnergy = 0;
        player.hasDrawnThisTurn = false;

        game.currentTurnUserId = opponent.userId;
        game.turnNumber += 1;

        this.triggerTurnStart(game, opponent);

        const drawn = drawCard(game, opponent.userId);
        if (!drawn) {
          await onEndGame(game, userId, 'deck_empty', server);
          return {};
        }
        game.phase = 'main';
        addLog(game, `─── Tour ${game.turnNumber} — ${opponent.username} ───`);
        onTurnEnd(game, server);
        break;
      }

      default:
        return { error: `Phase invalide : ${game.phase}` };
    }

    emitGameState(game, server);
    return {};
  }

  async discard(
    game: GameState,
    userId: number,
    handIndex: number,
    server: Server,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'end')
      return { error: 'Défausse en phase de fin uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);
    addLog(game, `${player.username} défausse ${card.baseCard.name}`);
    emitGameState(game, server);
    return {};
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private triggerTurnStart(game: GameState, player: PlayerGameState): void {
    const log: string[] = [];

    // Compteurs traités EN PREMIER : un monstre qui meurt au compteur 0
    // ne déclenche pas son ON_TURN_START ce même tour.
    this.processTurnCounters(game, player, log);

    for (const zone of player.monsterZones) {
      if (!zone) continue;

      // ON_TURN_START du monstre
      this.effectsResolver.resolve(zone.card, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        sourceMonster: zone,
        log,
      });

      // ON_TURN_START de chaque équipement attaché.
      // sourceMonster = zone hôte → les targets SELF résolvent sur le porteur.
      for (const equipment of zone.equipments) {
        this.effectsResolver.resolve(equipment, EffectTrigger.ON_TURN_START, {
          game,
          ownerUserId: player.userId,
          sourceMonster: zone,
          log,
        });
      }
    }

    // Terrains ON_TURN_START
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      this.effectsResolver.resolve(terrain, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        log,
      });
    }

    log.forEach((l) => addLog(game, l));
    this.buffsCalc.recalculate(player);
  }

  /**
   * Décrémente le turnCounter de chaque monstre de `player`.
   * Quand il atteint 0 : le joueur récupère une Prime, puis le monstre
   * est détruit (ON_DEATH déclenché, équipements au cimetière).
   *
   * Utilisé par Noyau Zeta — si détruit avant (Formatage/Recyclage),
   * pas de Prime gagnée.
   */
  private processTurnCounters(
    game: GameState,
    player: PlayerGameState,
    log: string[],
  ): void {
    // On scanne les DEUX terrains : Zeta peut être posé sur le terrain adverse
    // mais ownerUserId pointe vers le poseur → le compteur décrémente à son tour.
    const both = [
      { zones: player.monsterZones, host: player },
      {
        zones: (player === game.player1 ? game.player2 : game.player1)
          .monsterZones,
        host: player === game.player1 ? game.player2 : game.player1,
      },
    ];

    for (const { zones, host } of both) {
      for (let idx = 0; idx < zones.length; idx++) {
        const zone = zones[idx];
        // Décrémente uniquement si ce joueur est le poseur (ownerUserId) ou si
        // ownerUserId est absent et la zone appartient au joueur courant (comportement normal)
        if (!zone || zone.turnCounter === undefined) continue;
        const realOwner = zone.ownerUserId ?? host.userId;
        if (realOwner !== player.userId) continue;

        zone.turnCounter -= 1;
        log.push(
          `⏳ ${zone.card.baseCard.name} — ${zone.turnCounter} tour(s) avant autodestruction`,
        );

        if (zone.turnCounter > 0) continue;

        log.push(`💀 ${zone.card.baseCard.name} s'autodétruit !`);

        // Prime pour le poseur (player = le joueur dont c'est le tour = le bon)
        if (player.primeDeck.length > 0) {
          const prime = player.primeDeck.shift()!;
          player.primes -= 1;
          player.hand.push(prime);
          log.push(
            `🏆 ${player.username} récupère une Prime (${zone.card.baseCard.name}) — ${player.primes} restante(s)`,
          );
        }

        // ON_DEATH avant suppression — ownerUserId = hôte de la zone
        const deathLog: string[] = [];
        this.effectsResolver.resolve(zone.card, EffectTrigger.ON_DEATH, {
          game,
          ownerUserId: host.userId,
          sourceMonster: zone,
          log: deathLog,
        });
        deathLog.forEach((l) => log.push(l));

        host.graveyard.push(...zone.equipments, zone.card);
        zones[idx] = null;
      }
    } // end both loop
  }
}
