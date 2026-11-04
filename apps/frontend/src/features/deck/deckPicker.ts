import { CardType, checkDeckForMatch } from "@pipou/shared";
import type { CardInDeck, Deck } from "../../services/deck.service";
import type { Card } from "../../services/card.service";

export const deckTotal = (d: Deck) =>
  d.deckCards.reduce((sum, dc) => sum + dc.quantity, 0);

/** Le back accepterait ce deck au lancement d'un combat. */
export function isPlayable(d: Deck): boolean {
  return (
    checkDeckForMatch(
      d.deckCards.map((dc) => ({
        cardId: dc.userCard.card.id,
        cardName: dc.userCard.card.name,
        quantity: dc.quantity,
        owned: dc.userCard.quantity,
      })),
    ) === null
  );
}

/** Favoris d'abord, puis par nom. */
export function sortDecks(decks: readonly Deck[]): Deck[] {
  return [...decks].sort(
    (a, b) =>
      Number(b.isFavorite) - Number(a.isFavorite) ||
      a.name.localeCompare(b.name),
  );
}

const usedAt = (d: Deck) => (d.lastUsedAt ? Date.parse(d.lastUsedAt) : 0);

export function lastUsedDeckId(decks: readonly Deck[]): number | null {
  let best: Deck | null = null;
  for (const d of decks) if (usedAt(d) > (best ? usedAt(best) : 0)) best = d;
  return best?.id ?? null;
}

/** Le dernier deck utilisé, sinon le premier favori, sinon le premier par nom. */
export function defaultDeck(playable: readonly Deck[]): Deck | null {
  const lastId = lastUsedDeckId(playable);
  return (
    playable.find((d) => d.id === lastId) ?? sortDecks(playable)[0] ?? null
  );
}

/** Carte de couverture : le monstre le plus cher, puis la plus forte ATK. */
export function coverCard(d: Deck): CardInDeck | null {
  const monsters = d.deckCards
    .map((dc) => dc.userCard.card)
    .filter((c) => c.type === CardType.MONSTER)
    .sort((a, b) => b.cost - a.cost || b.atk - a.atk);
  return monsters[0] ?? null;
}

/** Carte affichable par CardFace (sans effets ni set). */
export function cardFromDeck(c: CardInDeck): Card {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    supportType: c.supportType ?? null,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    description: c.description ?? undefined,
    image: c.image ?? null,
    cardSet: { id: 0, name: "" },
  };
}
