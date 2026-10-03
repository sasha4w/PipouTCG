import { checkDeckForMatch, DeckEntry } from './deck-rules';

const entry = (cardId: number, quantity: number, owned = 3): DeckEntry => ({
  cardId,
  cardName: `Carte ${cardId}`,
  quantity,
  owned,
});

/** 30 cartes valides : 10 cartes × 3 exemplaires. */
const validDeck = () => Array.from({ length: 10 }, (_, i) => entry(i + 1, 3));

describe('checkDeckForMatch', () => {
  it('accepte un deck de 30 cartes', () => {
    expect(checkDeckForMatch(validDeck())).toBeNull();
  });

  it('refuse moins de 30 ou plus de 40 cartes', () => {
    expect(checkDeckForMatch(validDeck().slice(1))).toContain('entre 30 et 40');
    expect(
      checkDeckForMatch([
        ...validDeck(),
        ...validDeck().map((e) => ({ ...e, cardId: e.cardId + 100 })),
      ]),
    ).toContain('entre 30 et 40');
  });

  it("refuse plus de 3 exemplaires d'une même carte", () => {
    const deck = validDeck();
    deck[0] = entry(1, 4, 4);
    deck[1] = entry(2, 2);
    expect(checkDeckForMatch(deck)).toContain('Maximum 3 exemplaires');
  });

  it('refuse un deck dont les cartes ne sont plus possédées', () => {
    const deck = validDeck();
    deck[0] = entry(1, 3, 1);
    expect(checkDeckForMatch(deck)).toContain('Carte 1');
  });
});
