import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState } from '../helpers/game-state.helper';

const TURN_TIMEOUT_MS = 90_000;
const HAND_LIMIT = 7;

@Injectable()
export class TurnTimeoutService {
  private timeouts = new Map<number, NodeJS.Timeout>();

  /**
   * Starts a new timeout for the current turn.
   * Calls `onTimeout` if the player hasn't acted in time.
   */
  start(
    game: GameState,
    server: Server,
    onTimeout: (game: GameState, server: Server) => Promise<void>,
  ): void {
    const handle = setTimeout(async () => {
      const player = getPlayerState(game, game.currentTurnUserId);

      addLog(game, `⏱️ Timeout — passage de phase automatique`);

      for (const z of player.monsterZones) {
        if (z) z.hasAttackedThisTurn = false;
      }

      if (game.phase === 'end') {
        while (player.hand.length > HAND_LIMIT) {
          player.graveyard.push(player.hand.pop()!);
        }
      }

      game.pendingChoice = undefined;

      await onTimeout(game, server);
    }, TURN_TIMEOUT_MS);

    this.timeouts.set(game.matchId, handle);
  }

  reset(
    game: GameState,
    server: Server,
    onTimeout: (game: GameState, server: Server) => Promise<void>,
  ): void {
    this.clear(game.matchId);
    this.start(game, server, onTimeout);
  }

  clear(matchId: number): void {
    const existing = this.timeouts.get(matchId);
    if (existing) clearTimeout(existing);
    this.timeouts.delete(matchId);
  }
}
