import { describe, it, expect } from "vitest";
import { DECK_RULES } from "@pipou/shared";
import {
  addCard,
  draftIsValid,
  draftSize,
  draftToEntries,
  fillTo,
  removeCard,
} from "../../features/sandbox/deckDraft";

describe("deckDraft", () => {
  it(`ajoute au plus ${DECK_RULES.MAX_COPIES} exemplaires d'une carte`, () => {
    let draft = {};
    for (let i = 0; i < 5; i++) draft = addCard(draft, 7);
    expect(draft).toEqual({ 7: DECK_RULES.MAX_COPIES });
  });

  it("retire un exemplaire, puis la ligne", () => {
    expect(removeCard({ 7: 2 }, 7)).toEqual({ 7: 1 });
    expect(removeCard({ 7: 1 }, 7)).toEqual({});
    expect(removeCard({}, 7)).toEqual({});
  });

  it("complète jusqu'à la taille voulue en parcourant les cartes", () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const draft = fillTo({ 1: 3 }, ids, DECK_RULES.MIN_CARDS);

    expect(draftSize(draft)).toBe(DECK_RULES.MIN_CARDS);
    expect(Object.values(draft).every((q) => q <= DECK_RULES.MAX_COPIES)).toBe(
      true,
    );
    expect(draftIsValid(draft)).toBe(true);
  });

  it("s'arrête si le catalogue ne suffit pas", () => {
    expect(draftSize(fillTo({}, [1, 2], DECK_RULES.MIN_CARDS))).toBe(
      2 * DECK_RULES.MAX_COPIES,
    );
  });

  it(`n'accepte que ${DECK_RULES.MIN_CARDS} à ${DECK_RULES.MAX_CARDS} cartes`, () => {
    expect(draftIsValid({ 1: 3 })).toBe(false);
    expect(draftToEntries({ 4: 2, 9: 1 })).toEqual([
      { cardId: 4, quantity: 2 },
      { cardId: 9, quantity: 1 },
    ]);
  });
});
