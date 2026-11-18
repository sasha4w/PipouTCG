import { seatPlayer } from '../../helpers/game-state.helper';
import { monsterCard } from '../../testing/cards';
import { randomWeights } from '../../testing/nn-weights';
import { scenario } from '../../testing/scenario';
import { NN_SCALE, nnEvaluator } from './nn-eval';

const game = () =>
  scenario({ p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] } });

describe('nnEvaluator', () => {
  const evaluate = nnEvaluator(randomWeights(11));

  it('position en cours : valeur finie dans [−1000, 1000]', () => {
    const v = evaluate(game(), 'p1', 'pipou');
    expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(v)).toBeLessThanOrEqual(NN_SCALE);
  });

  it('fin de partie : ±Infinity, nul −10 000', () => {
    const won = game();
    won.phase = 'finished';
    won.winner = seatPlayer(won, 'p1').userId;
    expect(evaluate(won, 'p1', 'pipou')).toBe(Infinity);
    expect(evaluate(won, 'p2', 'pipou')).toBe(-Infinity);
    const draw = game();
    draw.phase = 'finished';
    expect(evaluate(draw, 'p1', 'pipou')).toBe(-10 * NN_SCALE);
  });
});
