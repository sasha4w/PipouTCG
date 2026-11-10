import { monsterCard } from '../testing/cards';
import { P1_ID, scenario } from '../testing/scenario';
import { evaluateLegacy } from './evaluate';
import { FEATURE_NAMES, features } from './features';
import {
  LEARNED_SCALE,
  evaluatorOf,
  learnedEvaluator,
  parseNote,
} from './learned-eval';
import type { LearnedWeights } from './learned-eval';
import { LEARNED_WEIGHTS } from './learned-weights';

const weights = (set: Record<string, number>): LearnedWeights => {
  const row = FEATURE_NAMES.map((n) => set[n] ?? 0);
  return {
    generation: 0,
    trainedAt: 'test',
    positions: 0,
    holdoutAccuracy: 0,
    features: [...FEATURE_NAMES],
    weights: { pipou: row, pixelman: row, dragon: row },
  };
};

const game = () =>
  scenario({
    turn: 'p1',
    phase: 'main',
    p1: { monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })] },
    p2: { monsters: [monsterCard('Colosse', { atk: 500, hp: 1000 })] },
  });

describe('note apprise', () => {
  it('somme pondérée des caractéristiques, à l’échelle', () => {
    const note = learnedEvaluator(weights({ myMonsters: 2, oppMonsters: -3 }));
    expect(note(game(), 'p1', 'pipou')).toBe(LEARNED_SCALE * (2 - 3));
  });

  it('le détail s’additionne au score', () => {
    const note = learnedEvaluator(
      weights({ bias: 0.5, myAtk: 0.1, oppHp: -0.2 }),
    );
    const parts: Record<string, number> = {};
    const score = note(game(), 'p1', 'pipou', true, parts);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(score);
    expect(Object.keys(parts).sort()).toEqual(['bias', 'myAtk', 'oppHp']);
  });

  it('fin de partie : ±Infinity', () => {
    const note = learnedEvaluator(weights({ bias: 1 }));
    const won = { ...game(), phase: 'finished' as const, winner: P1_ID };
    expect(note(won, 'p1', 'pipou')).toBe(Infinity);
    expect(note(won, 'p2', 'pipou')).toBe(-Infinity);
  });

  it('refuse des poids qui ne correspondent pas aux caractéristiques', () => {
    const bad = { ...weights({}), features: ['bias'] };
    expect(() => learnedEvaluator(bad)).toThrow(/caractéristiques/);
  });

  it('les poids versionnés correspondent aux caractéristiques', () => {
    expect(LEARNED_WEIGHTS.features).toEqual([...FEATURE_NAMES]);
    for (const row of Object.values(LEARNED_WEIGHTS.weights))
      expect(row).toHaveLength(features(game(), 'p1', 'pipou').length);
    expect(() => learnedEvaluator(LEARNED_WEIGHTS)).not.toThrow();
  });

  it('evaluatorOf choisit la note', () => {
    expect(evaluatorOf('legacy')).toBe(evaluateLegacy);
    const custom = weights({ myMonsters: 1 });
    expect(evaluatorOf(custom)(game(), 'p1', 'pipou')).toBe(LEARNED_SCALE);
    expect(typeof evaluatorOf('learned')(game(), 'p1', 'pipou')).toBe('number');
  });

  it('parseNote lit un nom ou garde le défaut', () => {
    expect(parseNote(undefined, 'legacy')).toBe('legacy');
    expect(parseNote('learned', 'legacy')).toBe('learned');
    expect(() => parseNote('nimporte', 'legacy')).toThrow(/Note inconnue/);
  });
});
