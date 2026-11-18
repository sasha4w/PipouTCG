import { allRealCards } from '../../testing/real-cards';
import { CARD_DIM, ENCODING_VERSION, GLOBAL_DIM, SET_NAMES } from './encode';
import {
  collectGame,
  planSelfplay,
  selfplayMeta,
  SAMPLES_PER_KIND,
} from './selfplay';

const options = {
  games: 3,
  seed: 4,
  note: 'legacy' as const,
  budget: 150,
  temperature: 50,
  exploreDecisions: 8,
};

describe('auto-jeu', () => {
  const cards = allRealCards();

  it('plan déterministe, deux decks différents, planificateur au budget donné', () => {
    const a = planSelfplay(cards, options);
    const b = planSelfplay(cards, options);
    expect(a.map((g) => [g.p1.name, g.p2.name, g.seed])).toEqual(
      b.map((g) => [g.p1.name, g.p2.name, g.seed]),
    );
    expect(a).toHaveLength(3);
    for (const g of a) {
      expect(g.p1.brain).toBe('plan');
      expect(g.p1.thinking).toEqual({ budget: 150 });
      expect(g.p1.temperatureDecisions).toBe(8);
      expect(g.p1.deck).not.toBe(g.p2.deck);
    }
  });

  it('une partie : positions au format, résultat ±1 ou 0, au plus 4 par joueur et par sorte', () => {
    const [game] = planSelfplay(cards, options);
    const samples = collectGame(game);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThanOrEqual(2 * 2 * SAMPLES_PER_KIND);
    for (const s of samples) {
      expect(s.g).toBe(game.g);
      expect(s.v).toBe(ENCODING_VERSION);
      expect([-1, 0, 1]).toContain(s.y);
      expect(s.global).toHaveLength(GLOBAL_DIM);
      expect(Object.keys(s.sets)).toEqual([...SET_NAMES]);
    }
    // deux camps : des étiquettes opposées (ou 0 et 0 en cas de nul)
    const labels = new Set(samples.map((s) => s.y));
    expect(labels.has(1) === labels.has(-1)).toBe(true);
  }, 60_000);

  it('collectGame est déterministe : même graine, même sortie', () => {
    const [game] = planSelfplay(cards, { ...options, budget: 50 });
    expect(collectGame(game)).toEqual(collectGame(game));
  }, 60_000);

  it('meta : dimensions et x statique de chaque carte', () => {
    const meta = selfplayMeta(cards);
    expect(meta.globalDim).toBe(GLOBAL_DIM);
    expect(meta.cardDim).toBe(CARD_DIM);
    expect(meta.sets).toEqual([...SET_NAMES]);
    expect(Object.keys(meta.cards)).toHaveLength(
      new Set(cards.map((c) => c.id)).size,
    );
  });
});
