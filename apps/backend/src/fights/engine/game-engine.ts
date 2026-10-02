import { Inject, Injectable } from '@nestjs/common';
import { HAND_LIMIT, STARTING_HAND, STARTING_PRIMES } from '@pipou/shared';
import type { GameAction, Seat } from '@pipou/shared';
import { CardInstance, GameState } from '../interfaces/game-state.interface';
import { PhaseService } from '../services/phase.service';
import { RNG, type Rng } from './rng';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';
import {
  addLog,
  checkWinCondition,
  getPlayerState,
  seatPlayer,
} from '../helpers/game-state.helper';
import { finishGame } from '../helpers/game-end.helper';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';

export interface EngineResult {
  error?: string;
}

/**
 * Point d'entrée unique des règles du duel. Applique une action à l'état de
 * partie sans connaître Socket.io ni la base : l'appelant émet l'état et
 * persiste la fin de partie (phase 'finished').
 */
@Injectable()
export class GameEngine {
  constructor(
    private phase: PhaseService,
    private summon: SummonService,
    private support: SupportService,
    private battle: BattleService,
    private pick: PickService,
    private effects: EffectsResolverService,
    private buffs: BuffsCalculatorService,
    @Inject(RNG) private rng: Rng,
  ) {}

  dispatch(game: GameState, seat: Seat, action: GameAction): EngineResult {
    if (game.phase === 'finished') return { error: 'La partie est terminée' };
    if (game.phase === 'waiting')
      return { error: "La partie n'a pas commencé" };
    if (game.phase === 'mulligan' && action.type !== 'mulligan')
      return { error: 'Phase de mulligan en cours' };
    const userId = seatPlayer(game, seat).userId;
    const result = this.apply(game, userId, action);
    if (!result.error) this.settle(game);
    return result;
  }

  /** Installe le deck d'un joueur ; lance le mulligan quand les deux sont prêts. */
  setupDeck(game: GameState, seat: Seat, cards: CardInstance[]): EngineResult {
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };
    const player = seatPlayer(game, seat);
    if (player.ready) return { error: 'Deck déjà soumis' };

    const deck = this.rng.shuffle([...cards]);
    player.primeDeck = deck.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.hand = deck.splice(0, STARTING_HAND);
    player.deck = deck;
    player.ready = true;

    if (game.player1.ready && game.player2.ready) {
      game.phase = 'mulligan';
      const first = this.rng.coinFlip() ? game.player1 : game.player2;
      game.currentTurnUserId = first.userId;
      addLog(game, `🎲 ${first.username} commencera la partie`);
    }
    return {};
  }

  /** Temps écoulé : mains gardées au mulligan, sinon défausse auto, choix annulé, phase suivante. */
  timeout(game: GameState): void {
    if (game.phase === 'finished' || game.phase === 'waiting') return;
    if (game.phase === 'mulligan') {
      game.player1.mulliganDone = true;
      game.player2.mulliganDone = true;
      addLog(game, '⏱️ Timeout — mains de départ conservées');
      this.startMatch(game);
      this.settle(game);
      return;
    }
    const player = getPlayerState(game, game.currentTurnUserId);
    addLog(game, `⏱️ Timeout — passage de phase automatique`);
    if (game.phase === 'end') {
      while (player.hand.length > HAND_LIMIT) {
        player.graveyard.push(player.hand.pop()!);
      }
    }
    game.pendingChoice = undefined;
    this.phase.endPhase(game, player.userId);
    this.settle(game);
  }

  /** Stabilise l'état après un changement : buffs, monstres à 0 PV, victoire. */
  settle(game: GameState): void {
    if (game.phase === 'finished') return;
    this.buffs.recalculate(game);
    this.reapDeadMonsters(game);

    const outcome = checkWinCondition(game);
    if (outcome)
      finishGame(
        game,
        outcome.winnerUserId,
        outcome.winnerUserId === null ? 'double_ko' : 'primes_depleted',
      );
  }

  /** Détruit les monstres à 0 PV (perte de bonus, dégâts), jusqu'à stabilité. */
  private reapDeadMonsters(game: GameState): void {
    for (let pass = 0; pass < 5; pass++) {
      const log: string[] = [];
      let died = false;
      for (const player of [game.player1, game.player2]) {
        for (const m of player.monsterZones) {
          if (!m || m.currentHp > 0) continue;
          log.push(`💀 ${m.card.baseCard.name} succombe`);
          this.effects.destroyMonster(game, player, m.instanceId, log, {
            draw: true,
          });
          died = true;
        }
      }
      log.forEach((l) => addLog(game, l));
      if (!died) return;
      this.buffs.recalculate(game);
    }
  }

  private mulligan(
    game: GameState,
    userId: number,
    redraw: boolean,
  ): EngineResult {
    if (game.phase !== 'mulligan') return { error: 'Le mulligan est terminé' };
    const player = getPlayerState(game, userId);
    if (player.mulliganDone) return { error: 'Mulligan déjà décidé' };

    if (redraw) {
      player.deck.push(...player.hand);
      this.rng.shuffle(player.deck);
      player.hand = player.deck.splice(0, STARTING_HAND);
      addLog(game, `🔄 ${player.username} refait sa main`);
    }
    player.mulliganDone = true;
    if (game.player1.mulliganDone && game.player2.mulliganDone)
      this.startMatch(game);
    return {};
  }

  private startMatch(game: GameState): void {
    game.turnNumber = 1;
    addLog(game, '⚔️ Combat ! Tour 1');
    this.phase.startTurn(game, getPlayerState(game, game.currentTurnUserId));
  }

  private apply(
    game: GameState,
    userId: number,
    action: GameAction,
  ): EngineResult {
    switch (action.type) {
      case 'mulligan':
        return this.mulligan(game, userId, action.redraw);
      case 'end_phase':
        return this.phase.endPhase(game, userId);
      case 'summon':
        return this.summon.summon(
          game,
          userId,
          action.handIndex,
          action.zoneIndex,
          action.paymentHandIndices,
          action.onOpponentSide ?? false,
        );
      case 'play_support':
        return this.support.playSupport(
          game,
          userId,
          action.handIndex,
          action.zoneIndex,
          action.targetInstanceId,
        );
      case 'recycle':
        return this.support.recycleFromHand(game, userId, action.handIndex);
      case 'change_mode':
        return this.support.changeMode(
          game,
          userId,
          action.instanceId,
          action.mode,
        );
      case 'attack':
        return this.battle.attack(
          game,
          userId,
          action.attackerInstanceId,
          action.targetInstanceId,
          action.direct ?? false,
        );
      case 'discard':
        return this.phase.discard(game, userId, action.handIndex);
      case 'pick_cards':
        return this.pick.pickCards(game, userId, action.instanceIds);
    }
  }
}
