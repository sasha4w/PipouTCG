import type {
  GameEndReason,
  GameState,
} from '../interfaces/game-state.interface';
import { addLog, getPlayerState } from './game-state.helper';

/**
 * Termine la partie. winnerUserId null = match nul.
 * Sans effet si la partie est déjà terminée (la première fin l'emporte).
 */
export function finishGame(
  game: GameState,
  winnerUserId: number | null,
  reason: GameEndReason,
): void {
  if (game.phase === 'finished') return;
  game.phase = 'finished';
  game.winner = winnerUserId ?? undefined;
  game.endReason = reason;
  game.pendingChoice = undefined;
  addLog(
    game,
    winnerUserId === null
      ? '🤝 Match nul !'
      : `🎉 ${getPlayerState(game, winnerUserId).username} remporte la victoire !`,
  );
}
