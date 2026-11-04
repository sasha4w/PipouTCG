import {
  DUST_VALUE,
  isForgeable,
  nextForgeRarity,
  requiresAllElements,
  Rarity,
  type UsableCard,
} from "@pipou/shared";
import type { ForgeSelection } from "../forge/forgeSelection";
import type { Card } from "../../services/card.service";
import type { UserCollection } from "../../services/user.service";

/** Carte du catalogue jointe à l'état du joueur. */
export interface OwnedCard {
  card: Card;
  owned: number;
  /** Copies utilisables (hors decks et verrou), calculées par le serveur. */
  usable: number;
  /** Copies verrouillées par le joueur. */
  locked: number;
}

/** Une entrée par carte du catalogue ; 0 pour ce que le joueur n'a pas. */
export function joinOwnedCards(
  catalog: Card[],
  collection: UserCollection,
  usable: UsableCard[],
): OwnedCard[] {
  const ownedById = new Map<number, number>();
  const lockedById = new Map<number, number>();
  for (const set of collection.sets)
    for (const c of set.cards) {
      ownedById.set(c.id, c.quantity);
      lockedById.set(c.id, c.lockedQuantity ?? 0);
    }
  const usableById = new Map<number, UsableCard>();
  for (const u of usable) usableById.set(u.cardId, u);
  return catalog.map((card) => ({
    card,
    owned: ownedById.get(card.id) ?? 0,
    usable: usableById.get(card.id)?.usable ?? 0,
    locked:
      usableById.get(card.id)?.lockedQuantity ?? lockedById.get(card.id) ?? 0,
  }));
}

/** Une carte est une cible de forge sauf si elle n'a pas de set ou n'est pas forgeable. */
export function isForgeTarget(card: Card): boolean {
  if (!card.cardSet) return false;
  return !requiresAllElements(card.effects);
}

export function forgeInputs(
  cards: OwnedCard[],
  lock: { setId: number; rarity: Rarity } | null,
): OwnedCard[] {
  return cards.filter(
    (c) =>
      c.owned > 0 &&
      isForgeable(c.card.rarity) &&
      (!lock ||
        (c.card.cardSet?.id === lock.setId && c.card.rarity === lock.rarity)),
  );
}

export function forgeTargets(
  cards: OwnedCard[],
  setId: number,
  rarity: Rarity,
): OwnedCard[] {
  const next = nextForgeRarity(rarity);
  if (!next) return [];
  return cards.filter(
    (c) =>
      c.card.cardSet?.id === setId &&
      c.card.rarity === next &&
      isForgeTarget(c.card),
  );
}

export interface QuickDestroyOptions {
  keep: 1 | 2 | 3;
  rarities: Rarity[];
  setId: number | null;
}

export const DEFAULT_QUICK_DESTROY: QuickDestroyOptions = {
  keep: 3,
  rarities: [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE],
  setId: null,
};

export interface DestroyLine {
  card: Card;
  quantity: number;
  dust: number;
}

/** Doublons à détruire : on garde `keep` copies, sans toucher aux copies non utilisables. */
export function quickDestroyPlan(
  cards: OwnedCard[],
  opts: QuickDestroyOptions,
): DestroyLine[] {
  const lines: DestroyLine[] = [];
  for (const c of cards) {
    if (!opts.rarities.includes(c.card.rarity)) continue;
    if (opts.setId !== null && c.card.cardSet?.id !== opts.setId) continue;
    const quantity = Math.min(c.usable, c.owned - opts.keep);
    if (quantity <= 0) continue;
    lines.push({
      card: c.card,
      quantity,
      dust: quantity * DUST_VALUE[c.card.rarity],
    });
  }
  return lines;
}

export const HIGH_RARITIES: Rarity[] = [
  Rarity.EPIC,
  Rarity.LEGENDARY,
  Rarity.SECRET,
];

export function hasHighRarity(lines: DestroyLine[]): boolean {
  return lines.some((l) => HIGH_RARITIES.includes(l.card.rarity));
}

/**
 * Reconstitue une sélection de forge après une forge réussie : mêmes cartes
 * (bornées par `usable` rafraîchi), puis autres copies utilisables du même set
 * et de la même rareté par surplus décroissant. Jamais la cible.
 */
export function refillForgeSelection(
  previous: ForgeSelection,
  cards: OwnedCard[],
  cost: number,
  targetCardId: number,
): { selection: ForgeSelection; complete: boolean } {
  const reference = cards.find((c) => (previous[c.card.id] ?? 0) > 0);
  const selection: ForgeSelection = {};
  if (!reference) return { selection, complete: false };
  const setId = reference.card.cardSet?.id;
  const rarity = reference.card.rarity;
  const pool = cards.filter(
    (c) =>
      c.card.id !== targetCardId &&
      c.card.cardSet?.id === setId &&
      c.card.rarity === rarity,
  );
  let total = 0;
  const take = (c: OwnedCard, wanted: number) => {
    const free = c.usable - (selection[c.card.id] ?? 0);
    const qty = Math.min(wanted, free, cost - total);
    if (qty <= 0) return;
    selection[c.card.id] = (selection[c.card.id] ?? 0) + qty;
    total += qty;
  };
  for (const c of pool) take(c, previous[c.card.id] ?? 0);
  const rest = [...pool].sort(
    (a, b) =>
      b.usable -
        (selection[b.card.id] ?? 0) -
        (a.usable - (selection[a.card.id] ?? 0)) || a.card.id - b.card.id,
  );
  for (const c of rest) take(c, cost - total);
  return { selection, complete: total === cost };
}
