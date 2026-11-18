import { seatPlayer } from '../../helpers/game-state.helper';
import type { Evaluator } from '../evaluate';
import { encodePosition } from './encode';
import { NnModel } from './mlp';
import type { NnWeights } from './weights';

/** Valeur × 1000 : même ordre de grandeur que la note manuelle (MODE_TOLL, températures). */
export const NN_SCALE = 1000;
/** Partie nulle : à éviter, sans valoir une défaite. */
const DRAW = -10 * NN_SCALE;

export function nnEvaluator(w: NnWeights): Evaluator {
  const model = new NnModel(w);
  return (game, seat, archetype) => {
    if (game.phase === 'finished') {
      const me = seatPlayer(game, seat).userId;
      if (game.winner === me) return Infinity;
      if (game.winner != null) return -Infinity;
      return DRAW;
    }
    return NN_SCALE * model.value(encodePosition(game, seat, archetype));
  };
}
