import { allRealCards } from '../../testing/real-cards';
import { parseSide, planArena, playPair, verdict } from './arena';

describe('arène', () => {
  it('paires déterministes, decks distincts, graines d’arène 5001+', () => {
    const a = planArena(5, 1);
    expect(a).toEqual(planArena(5, 1));
    for (const p of a) {
      expect(p.deckSeed).toBeGreaterThanOrEqual(5001);
      expect(p.i).not.toBe(p.j);
    }
  });

  it('même cerveau des deux côtés, decks miroirs : résultats opposés ou nuls', () => {
    const [pair] = planArena(1, 2);
    const s = {
      challenger: 'legacy' as const,
      champion: 'legacy' as const,
      budget: 150,
    };
    const [a, b] = playPair(allRealCards(), pair, s);
    // Même cerveau, même graine : la partie B est la partie A, rôles échangés
    const flip = { win: 'loss', loss: 'win', draw: 'draw' } as const;
    expect(b).toBe(flip[a]);
  }, 60_000);

  it('verdict : nul = demi-victoire, borne de Wilson', () => {
    const v = verdict(['win', 'win', 'loss', 'draw']);
    expect(v).toMatchObject({
      games: 4,
      wins: 2,
      losses: 1,
      draws: 1,
      score: 0.625,
    });
    expect(v.lower).toBeLessThan(0.625);
  });

  it('parseSide : niveau ou note', () => {
    expect(parseSide('level:4')).toEqual({ level: 4 });
    expect(parseSide('legacy')).toBe('legacy');
    expect(() => parseSide('level:9')).toThrow();
  });
});
