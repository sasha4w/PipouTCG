import { FEATURE_NAMES } from './features';
import type { Sample } from './selfplay-data';
import { seeded } from './tournament';
import { fit, isHoldout, predict, train, weightsModule } from './train';

/** Victoire quand x1 est grand et x2 petit ; x3 ne varie jamais. */
function synthetic(n: number, seed: number) {
  const random = seeded(seed);
  return Array.from({ length: n }, () => {
    const x1 = random() * 10;
    const x2 = random() * 500;
    const p = 1 / (1 + Math.exp(-(0.8 * (x1 - 5) - 0.01 * (x2 - 250))));
    return { f: [1, x1, x2, 3], y: random() < p ? 1 : 0 };
  });
}

describe('fit', () => {
  const rows = synthetic(4000, 1);
  const w = fit(rows);

  it('retrouve le sens et l’ordre de grandeur des poids', () => {
    expect(w[1]).toBeGreaterThan(0.5);
    expect(w[1]).toBeLessThan(1.1);
    expect(w[2]).toBeLessThan(-0.006);
    expect(w[2]).toBeGreaterThan(-0.014);
  });

  it('une caractéristique qui ne varie pas reçoit un poids nul', () => {
    expect(w[3]).toBe(0);
  });

  it('prédit bien des positions jamais vues', () => {
    const fresh = synthetic(2000, 2);
    const right = fresh.filter((r) => predict(w, r.f) > 0.5 === (r.y === 1));
    expect(right.length / fresh.length).toBeGreaterThan(0.8);
  });

  it('reproductible', () => {
    expect(fit(rows)).toEqual(w);
  });

  it('sans données : aucun poids', () => {
    expect(fit([])).toEqual([]);
  });
});

describe('train', () => {
  const index = FEATURE_NAMES.indexOf('myMonsters');
  const samples: Sample[] = [];
  const random = seeded(3);
  for (let g = 0; g < 600; g++)
    for (const a of ['pipou', 'pixelman', 'dragon'] as const) {
      const f = FEATURE_NAMES.map(() => 0);
      f[0] = 1;
      f[index] = Math.floor(random() * 4);
      // Plus de monstres, plus de victoires
      const y = random() < 0.15 + 0.23 * f[index] ? 1 : 0;
      samples.push({ g, s: 'p1', a, o: 'pipou', end: true, f, y });
    }
  const { weights, byArchetype } = train(samples, 1, '2026-11-10');

  it('un vecteur par archétype, de la bonne longueur', () => {
    for (const a of ['pipou', 'pixelman', 'dragon'] as const) {
      expect(weights.weights[a]).toHaveLength(FEATURE_NAMES.length);
      expect(weights.weights[a][index]).toBeGreaterThan(0);
      expect(byArchetype[a].accuracy).toBeGreaterThan(0.6);
    }
    expect(weights.features).toEqual([...FEATURE_NAMES]);
    expect(weights.generation).toBe(1);
  });

  it('une partie sur dix est mise de côté, entière', () => {
    expect(isHoldout(20)).toBe(true);
    expect(isHoldout(21)).toBe(false);
    const kept = samples.filter((s) => !isHoldout(s.g)).length;
    expect(weights.positions).toBe(kept);
  });

  it('le module généré redonne les mêmes poids', () => {
    const source = weightsModule(weights);
    expect(source).toContain('export const LEARNED_WEIGHTS: LearnedWeights =');
    const json = source.slice(
      source.indexOf('= {') + 2,
      source.lastIndexOf(';'),
    );
    expect(JSON.parse(json)).toEqual(weights);
  });
});
