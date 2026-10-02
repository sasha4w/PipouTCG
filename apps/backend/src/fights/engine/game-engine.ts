import { Injectable } from '@nestjs/common';
import type { GameAction, Seat } from '@pipou/shared';
import { GameState } from '../interfaces/game-state.interface';
import { HAND_LIMIT, PhaseService } from '../services/phase.service';
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
  ) {}

  dispatch(game: GameState, seat: Seat, action: GameAction): EngineResult {
    if (game.phase === 'finished') return { error: 'La partie est terminée' };
    const userId = seatPlayer(game, seat).userId;
    const result = this.apply(game, userId, action);
    if (!result.error) this.settle(game);
    return result;
  }

  /** Temps écoulé pour le joueur actif : défausse auto, choix annulé, phase suivante. */
  timeout(game: GameState): void {
    if (game.phase === 'finished') return;
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

  private apply(
    game: GameState,
    userId: number,
    action: GameAction,
  ): EngineResult {
    switch (action.type) {
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
