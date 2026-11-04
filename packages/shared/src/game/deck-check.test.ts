import { describe, expect, it } from "vitest";
import { checkDeckForMatch, type DeckEntry } from "./deck-check";

const entry = (over: Partial<DeckEntry> = {}): DeckEntry => ({
  cardId: 1,
  cardName: "Recrue",
  quantity: 3,
  owned: 3,
  ...over,
});

/** `n` cartes distinctes à 3 exemplaires, plus un reste. */
function deckOf(total: number): DeckEntry[] {
  const out: DeckEntry[] = [];
  for (let id = 1; total > 0; id++) {
    const q = Math.min(3, total);
    out.push(entry({ cardId: id, cardName: `C${id}`, quantity: q, owned: q }));
    total -= q;
  }
  return out;
}

describe("checkDeckForMatch", () => {
  it("accepte un deck de 30 à 40 cartes", () => {
    expect(checkDeckForMatch(deckOf(30))).toBeNull();
    expect(checkDeckForMatch(deckOf(40))).toBeNull();
  });

  it("refuse moins de 30 ou plus de 40 cartes", () => {
    expect(checkDeckForMatch(deckOf(29))).toMatch(/entre 30 et 40/);
    expect(checkDeckForMatch(deckOf(41))).toMatch(/entre 30 et 40/);
  });

  it("refuse plus de 3 exemplaires d'une même carte", () => {
    const deck = deckOf(27);
    deck.push(entry({ cardId: 99, cardName: "Gribouille", quantity: 2, owned: 2 }));
    deck.push(entry({ cardId: 99, cardName: "Gribouille", quantity: 2, owned: 2 }));
    expect(checkDeckForMatch(deck)).toMatch(/Gribouille/);
  });

  it("refuse une carte qui n'est plus possédée en quantité suffisante", () => {
    const deck = deckOf(30);
    deck[0] = { ...deck[0], owned: 1 };
    expect(checkDeckForMatch(deck)).toMatch(/ne possèdes plus/);
  });
});
