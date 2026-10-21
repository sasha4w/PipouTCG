import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';

describe('buildGeneratedEntries', () => {
  const cards = allRealCards();

  it('produit 15 decks, déterministes pour une même graine', () => {
    const a = buildGeneratedEntries(cards, 1);
    const b = buildGeneratedEntries(cards, 1);
    expect(a).toHaveLength(15);
    expect(a.every((e) => e.deck.length > 0 && e.deck.every(Boolean))).toBe(
      true,
    );
    expect(a.map((e) => e.deck.map((c) => c.id))).toEqual(
      b.map((e) => e.deck.map((c) => c.id)),
    );
  });
});
