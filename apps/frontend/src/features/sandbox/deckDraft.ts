import { DECK_RULES, type SandboxDeckEntry } from "@pipou/shared";

/** Deck en cours de composition : cardId → quantité. */
export type DeckDraft = Record<number, number>;

export function draftSize(draft: DeckDraft): number {
  return Object.values(draft).reduce((sum, q) => sum + q, 0);
}

/** +1 exemplaire, dans la limite des exemplaires et de la taille du deck. */
export function addCard(draft: DeckDraft, cardId: number): DeckDraft {
  const count = draft[cardId] ?? 0;
  if (
    count >= DECK_RULES.MAX_COPIES ||
    draftSize(draft) >= DECK_RULES.MAX_CARDS
  )
    return draft;
  return { ...draft, [cardId]: count + 1 };
}

export function removeCard(draft: DeckDraft, cardId: number): DeckDraft {
  const count = draft[cardId] ?? 0;
  if (count === 0) return draft;
  const next = { ...draft };
  if (count === 1) delete next[cardId];
  else next[cardId] = count - 1;
  return next;
}

/** Ajoute les cartes une à une, en boucle, jusqu'à `target` (ou saturation). */
export function fillTo(
  draft: DeckDraft,
  cardIds: number[],
  target: number,
): DeckDraft {
  let next = draft;
  let progressed = true;
  while (draftSize(next) < target && progressed) {
    progressed = false;
    for (const id of cardIds) {
      if (draftSize(next) >= target) break;
      const added = addCard(next, id);
      if (added !== next) progressed = true;
      next = added;
    }
  }
  return next;
}

export function draftIsValid(draft: DeckDraft): boolean {
  const size = draftSize(draft);
  return size >= DECK_RULES.MIN_CARDS && size <= DECK_RULES.MAX_CARDS;
}

export function draftToEntries(draft: DeckDraft): SandboxDeckEntry[] {
  return Object.entries(draft).map(([id, quantity]) => ({
    cardId: Number(id),
    quantity,
  }));
}
