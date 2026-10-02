import { Injectable } from '@nestjs/common';
import { EffectTrigger, HAND_LIMIT } from '@pipou/shared';
import { GameState, PlayerGameState } from '../interfaces/game-state.interface';
import {
  addLog,
  drawCard,
  gainPrime,
  getOpponentState,
  getPlayerState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';
import { finishGame } from '../helpers/game-end.helper';
import { EffectsResolverService } from '../effects-resolver.service';

@Injectable()
export class PhaseService {
  constructor(private effectsResolver: EffectsResolverService) {}

  endPhase(game: GameState, userId: number): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    switch (game.phase) {
      case 'main':
        game.phase = 'battle';
        addLog(game, `${player.username} → phase de combat`);
        return {};

      case 'battle':
        game.phase = 'end';
        return {};

      case 'end': {
        const surplus = player.hand.length - HAND_LIMIT;
        if (surplus > 0)
          return { error: `Défaussez ${surplus} carte(s) avant de terminer` };

        this.endTurn(game, player);
        game.currentTurnUserId = opponent.userId;
        game.turnNumber += 1;
        this.startTurn(game, opponent);
        return {};
      }

      default:
        return { error: `Phase invalide : ${game.phase}` };
    }
  }

  discard(
    game: GameState,
    userId: number,
    handIndex: number,
  ): { error?: string } {
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
    return {};
  }

  /** Début de tour : compteurs, ON_TURN_START, double attaque différée, pioche. */
  startTurn(game: GameState, player: PlayerGameState): void {
    const log: string[] = [];
    // Compteurs en premier : un monstre détruit au compteur 0 ne déclenche
    // pas son ON_TURN_START ce même tour.
    this.processTurnCounters(game, player, log);
    this.resolveForBoard(game, player, EffectTrigger.ON_TURN_START, log);
    for (const m of player.monsterZones) {
      if (!m?.doubleAtkNextTurn) continue;
      m.extraAttacksThisTurn = 1;
      m.doubleAtkNextTurn = false;
    }
    log.forEach((l) => addLog(game, l));

    const drawn = drawCard(game, player.userId);
    if (!drawn) {
      finishGame(
        game,
        getOpponentState(game, player.userId).userId,
        'deck_empty',
      );
      return;
    }
    game.phase = 'main';
    addLog(game, `─── Tour ${game.turnNumber} — ${player.username} ───`);
  }

  /** Fin du tour du joueur actif : ON_TURN_END, remises à zéro, gel décompté. */
  private endTurn(game: GameState, player: PlayerGameState): void {
    const log: string[] = [];
    this.resolveForBoard(game, player, EffectTrigger.ON_TURN_END, log);

    // Les bonus d'ATK temporaires expirent pour les deux camps
    for (const p of [game.player1, game.player2]) {
      for (const m of p.monsterZones) if (m) m.tempAtkBuff = 0;
    }

    for (const m of player.monsterZones) {
      if (!m) continue;
      m.hasAttackedThisTurn = false;
      m.attacksUsedThisTurn = 0;
      m.extraAttacksThisTurn = 0;
      m.summonedThisTurn = false;
      // Le gel compte les tours du propriétaire du monstre gelé
      if (m.blockAttackTurns !== undefined) {
        m.blockAttackTurns -= 1;
        if (m.blockAttackTurns <= 0) {
          m.blockAttackTurns = undefined;
          log.push(`🧊 ${m.card.baseCard.name} pourra de nouveau attaquer`);
        }
      }
    }
    player.recycleEnergy = 0;
    log.forEach((l) => addLog(game, l));
  }

  /** Déclenche `trigger` pour les monstres, leurs équipements (SELF = porteur) et les terrains. */
  private resolveForBoard(
    game: GameState,
    player: PlayerGameState,
    trigger: EffectTrigger,
    log: string[],
  ): void {
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      this.effectsResolver.resolve(zone.card, trigger, {
        game,
        ownerUserId: player.userId,
        sourceMonster: zone,
        log,
      });
      if (!player.monsterZones.includes(zone)) continue;
      for (const equipment of zone.equipments) {
        this.effectsResolver.resolve(equipment, trigger, {
          game,
          ownerUserId: player.userId,
          sourceMonster: zone,
          log,
        });
      }
    }
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      this.effectsResolver.resolve(terrain, trigger, {
        game,
        ownerUserId: player.userId,
        log,
      });
    }
  }

  /**
   * Décrémente le turnCounter des monstres posés par `player` (sur les deux
   * terrains : Zeta peut être posé chez l'adversaire). À 0 : le poseur gagne
   * une Prime et le monstre est détruit, sans pioche pour l'hôte.
   */
  private processTurnCounters(
    game: GameState,
    player: PlayerGameState,
    log: string[],
  ): void {
    const other = player === game.player1 ? game.player2 : game.player1;
    for (const host of [player, other]) {
      for (const zone of [...host.monsterZones]) {
        if (!zone || zone.turnCounter === undefined) continue;
        const poser = zone.ownerUserId ?? host.userId;
        if (poser !== player.userId) continue;

        zone.turnCounter -= 1;
        log.push(
          `⏳ ${zone.card.baseCard.name} — ${zone.turnCounter} tour(s) avant autodestruction`,
        );
        if (zone.turnCounter > 0) continue;

        log.push(`💀 ${zone.card.baseCard.name} s'autodétruit !`);
        gainPrime(game, player.userId, zone.card.baseCard.name);
        this.effectsResolver.destroyMonster(game, host, zone.instanceId, log, {
          draw: false,
        });
      }
    }
  }
}
