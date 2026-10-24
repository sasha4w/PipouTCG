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

  it('cartes exclues : aucun deck ne les contient', () => {
    const excluded = ['Sentinelle Gargouille', 'Bébé Teros', 'Œuf Céleste'];
    expect(
      buildGeneratedEntries(cards, 1).some((e) =>
        e.deck.some((c) => excluded.includes(c.name)),
      ),
    ).toBe(true);
    const entries = buildGeneratedEntries(cards, 1, excluded);
    expect(entries).toHaveLength(15);
    expect(
      entries.some((e) => e.deck.some((c) => excluded.includes(c.name))),
    ).toBe(false);
  });
});
