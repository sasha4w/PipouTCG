import { monsterCard } from '../testing/cards';
import { createEngine } from '../testing/engine';
import { monsterNamed, scenario, seatState } from '../testing/scenario';
import type { Evaluator } from './evaluate';
import { regretOf } from './regret';
import type { BenchPosition } from './regret';

const engine = createEngine();

function position(): BenchPosition {
  const state = scenario({
    turn: 'p1',
    phase: 'main',
    p1: { monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })] },
    p2: { monsters: [monsterCard('Colosse', { atk: 500, hp: 1000 })] },
  });
  return {
    id: 'test:1',
    seat: 'p1',
    archetype: 'pipou',
    state,
    rows: [
      { action: { type: 'end_phase' }, wins: 20, n: 24 },
      {
        action: {
          type: 'change_mode',
          instanceId: monsterNamed(state, 'p1', 'Lame').instanceId,
          mode: 'guard',
        },
        wins: 5,
        n: 24,
      },
    ],
  };
}

/** Aime (ou non) avoir un monstre en Garde. */
const guardLover =
  (sign: number): Evaluator =>
  (game, seat) =>
    sign *
    seatState(game, seat).monsterZones.filter((m) => m?.mode === 'guard')
      .length;

describe('regretOf', () => {
  it('nul quand la note préfère le coup qui gagne le plus', () => {
    expect(regretOf(engine, position(), guardLover(-1))).toEqual({
      regret: 0,
      best: true,
    });
  });

  it('écart de taux de victoire quand elle en préfère un autre', () => {
    const r = regretOf(engine, position(), guardLover(1))!;
    expect(r.regret).toBeCloseTo((20 - 5) / 24);
    expect(r.best).toBe(false);
  });

  it('null s’il reste moins de deux coups jouables', () => {
    const pos = position();
    pos.rows = [pos.rows[0]];
    expect(regretOf(engine, pos, guardLover(1))).toBeNull();
  });

  it('ne modifie pas la position', () => {
    const pos = position();
    const before = JSON.stringify(pos);
    regretOf(engine, pos, guardLover(1));
    expect(JSON.stringify(pos)).toBe(before);
  });
});
