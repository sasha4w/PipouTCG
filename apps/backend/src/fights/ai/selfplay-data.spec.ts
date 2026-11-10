import { allRealCards } from '../testing/real-cards';
import { FEATURE_NAMES } from './features';
import { buildGeneratedEntries } from './generated-entries';
import { SAMPLES_PER_KIND, collectGame } from './selfplay-data';

const [a, b] = buildGeneratedEntries(allRealCards(), 1).filter(
  (e) => e.level === 5,
);

describe('collectGame', () => {
  const samples = collectGame(a, b, 123, 7);

  it('des positions des deux joueurs, des deux sortes, sans dépasser le plafond', () => {
    for (const s of ['p1', 'p2'] as const)
      for (const end of [true, false]) {
        const kind = samples.filter((x) => x.s === s && x.end === end);
        expect(kind.length).toBeGreaterThan(0);
        expect(kind.length).toBeLessThanOrEqual(SAMPLES_PER_KIND);
      }
  });

  it('chaque ligne porte la partie, les archétypes et un vecteur complet', () => {
    for (const x of samples) {
      expect(x.g).toBe(7);
      expect(x.f).toHaveLength(FEATURE_NAMES.length);
      expect(x.f.every(Number.isFinite)).toBe(true);
      expect(x.a).toBe(x.s === 'p1' ? a.archetype : b.archetype);
      expect(x.o).toBe(x.s === 'p1' ? b.archetype : a.archetype);
    }
  });

  it('les étiquettes des deux joueurs se complètent', () => {
    const y = (s: 'p1' | 'p2') => samples.find((x) => x.s === s)!.y;
    expect(y('p1') + y('p2')).toBe(1);
    expect([0, 0.5, 1]).toContain(y('p1'));
  });

  it('reproductible', () => {
    expect(collectGame(a, b, 123, 7)).toEqual(samples);
  });
});
