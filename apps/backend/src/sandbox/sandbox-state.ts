import type { SandboxState } from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { buildClientState } from '../fights/helpers/client-state.builder';

/** Vue complète du sandbox : chaque siège, decks ordonnés, annulation. */
export function buildSandboxState(sb: {
  game: GameState;
  undo: unknown[];
  redo: unknown[];
  timer: boolean;
}): SandboxState {
  const { game } = sb;
  return {
    views: {
      p1: buildClientState(game, game.player1.userId),
      p2: buildClientState(game, game.player2.userId),
    },
    decks: { p1: game.player1.deck, p2: game.player2.deck },
    canUndo: sb.undo.length > 0,
    canRedo: sb.redo.length > 0,
    timer: sb.timer,
  };
}
