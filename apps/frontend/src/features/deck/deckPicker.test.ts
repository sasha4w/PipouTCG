import { describe, expect, it } from "vitest";
import { CardType } from "@pipou/shared";
import type { CardInDeck, Deck } from "../../services/deck.service";
import {
  coverCard,
  defaultDeck,
  deckTotal,
  isPlayable,
  lastUsedDeckId,
  sortDecks,
} from "./deckPicker";

let nextId = 1;
const card = (over: Partial<CardInDeck> = {}): CardInDeck =>
  ({
    id: nextId++,
    name: `Carte ${nextId}`,
    rarity: "common",
    type: CardType.MONSTER,
    atk: 100,
    hp: 100,
    cost: 1,
    ...over,
  }) as CardInDeck;

/** Deck de `total` cartes à 3 exemplaires possédés. */
function deck(over: Partial<Deck> = {}, total = 30): Deck {
  const deckCards: Deck["deckCards"] = [];
  for (let left = total; left > 0; left -= 3) {
    const c = card();
    const q = Math.min(3, left);
    deckCards.push({ quantity: q, userCard: { id: c.id, card: c, quantity: 3 } });
  }
  return {
    id: nextId++,
    name: "Deck",
    userId: 1,
    deckCards,
    createdAt: "",
    updatedAt: "",
    isFavorite: false,
    lastUsedAt: null,
    ...over,
  };
}

describe("deckPicker", () => {
  it("compte les cartes", () => {
    expect(deckTotal(deck({}, 35))).toBe(35);
  });

  it("jouable : 30 à 40 cartes toujours possédées", () => {
    expect(isPlayable(deck({}, 35))).toBe(true);
    expect(isPlayable(deck({}, 20))).toBe(false);
    const sold = deck({}, 30);
    sold.deckCards[0].userCard.quantity = 1;
    expect(isPlayable(sold)).toBe(false);
  });

  it("trie favoris d'abord, puis par nom", () => {
    const b = deck({ name: "B" });
    const a = deck({ name: "A" });
    const z = deck({ name: "Z", isFavorite: true });
    expect(sortDecks([b, a, z]).map((d) => d.name)).toEqual(["Z", "A", "B"]);
  });

  it("par défaut : le dernier utilisé", () => {
    const old = deck({ name: "A", isFavorite: true, lastUsedAt: "2026-11-01T10:00:00Z" });
    const last = deck({ name: "B", lastUsedAt: "2026-11-03T10:00:00Z" });
    expect(defaultDeck([old, last])).toBe(last);
    expect(lastUsedDeckId([old, last])).toBe(last.id);
  });

  it("par défaut sans historique : premier favori, sinon premier par nom", () => {
    const a = deck({ name: "A" });
    const fav = deck({ name: "Z", isFavorite: true });
    expect(defaultDeck([a, fav])).toBe(fav);
    expect(defaultDeck([deck({ name: "B" }), a])).toBe(a);
    expect(defaultDeck([])).toBeNull();
  });

  it("couverture : monstre le plus cher, puis la plus forte ATK", () => {
    const d = deck({}, 0);
    const spell = card({ type: CardType.SUPPORT, cost: 9 });
    const weak = card({ cost: 3, atk: 500 });
    const strong = card({ cost: 3, atk: 900 });
    const cheap = card({ cost: 1, atk: 2000 });
    for (const c of [spell, weak, strong, cheap])
      d.deckCards.push({ quantity: 1, userCard: { id: c.id, card: c, quantity: 1 } });
    expect(coverCard(d)).toBe(strong);
    expect(coverCard(deck({}, 0))).toBeNull();
  });
});
