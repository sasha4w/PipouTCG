import { Injectable, Logger } from '@nestjs/common';
import type { FightServer } from '../fight-socket.types';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState } from '../helpers/game-state.helper';

const TURN_TIMEOUT_MS = 90_000;
const HAND_LIMIT = 7;

@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);
  private timeouts = new Map<number, NodeJS.Timeout>();

  /**
   * Starts a new timeout for the current turn.
   * Calls `onTimeout` if the player hasn't acted in time.
   */
  start(
    game: GameState,
    server: FightServer,
    onTimeout: (game: GameState, server: FightServer) => Promise<void>,
  ): void {
    const handle = setTimeout(() => {
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

      // Rejet non géré dans un setTimeout = arrêt du processus Node : on le rattrape
      onTimeout(game, server).catch((err: unknown) =>
        this.logger.error(
          `Timeout du match ${game.matchId} en échec`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
    }, TURN_TIMEOUT_MS);

    this.timeouts.set(game.matchId, handle);
  }

  reset(
    game: GameState,
    server: FightServer,
    onTimeout: (game: GameState, server: FightServer) => Promise<void>,
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
