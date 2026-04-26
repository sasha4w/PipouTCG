import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState, GameEndReason } from '../interfaces/game-state.interface';
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

  private triggerTurnStart(game: GameState, player: any): void {
    const log: string[] = [];
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      this.effectsResolver.resolve(zone.card, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        sourceMonster: zone,
        log,
      });
    }
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      this.effectsResolver.resolve(terrain, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        log,
      });
    }
    log.forEach((l) => addLog(game, l));
  }
}
