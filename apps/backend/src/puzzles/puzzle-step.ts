import type { GameAction } from '@pipou/shared';
import type { GameEngine } from '../fights/engine/game-engine';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { activeChoice, listCandidates } from '../fights/ai/candidate-actions';
import { withRandom } from '../fights/helpers/seeded-random';
import { seatOf } from '../fights/helpers/game-state.helper';
import { recordEvents, type PuzzleTrack } from './puzzle-objective';

/** Garde-fou : un adversaire ne répond jamais plus de quelques fois dans un tour. */
const MAX_REPLIES = 8;

/**
 * Joue un coup du joueur 1. Tout l'aléa (mélange de deck…) est rejoué depuis
 * `seed` : même état + même action = même résultat, pour le joueur comme pour
 * le solveur. Si un effet demande un choix à l'adversaire, il prend le premier
 * coup possible (il n'y a personne en face).
 */
export function playPuzzleAction(
  engine: GameEngine,
  game: GameState,
  action: GameAction,
  seed: number,
  track: PuzzleTrack,
): { error?: string } {
  return withRandom(seed, () => {
    const result = engine.dispatch(game, 'p1', action);
    if (result.error) return { error: result.error };
    for (let i = 0; i < MAX_REPLIES; i++) {
      const choice = activeChoice(game);
      if (!choice || seatOf(game, choice.forUserId) !== 'p2') break;
      const [reply] = listCandidates(game, 'p2');
      if (!reply || engine.dispatch(game, 'p2', reply).error) break;
    }
    recordEvents(track, game);
    return {};
  });
}
