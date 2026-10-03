import { DECK_RULES } from '@pipou/shared';

export interface DeckEntry {
  cardId: number;
  cardName: string;
  quantity: number;
  /** Exemplaires possédés par le joueur au moment du lancement. */
  owned: number;
}

/** Message d'erreur si le deck ne peut pas être joué, sinon null. */
export function checkDeckForMatch(entries: DeckEntry[]): string | null {
  const total = entries.reduce((sum, e) => sum + e.quantity, 0);
  if (total < DECK_RULES.MIN_CARDS || total > DECK_RULES.MAX_CARDS)
    return `Un deck doit contenir entre ${DECK_RULES.MIN_CARDS} et ${DECK_RULES.MAX_CARDS} cartes (total actuel : ${total})`;

  const copies = new Map<number, { name: string; count: number }>();
  for (const e of entries) {
    const c = copies.get(e.cardId) ?? { name: e.cardName, count: 0 };
    c.count += e.quantity;
    copies.set(e.cardId, c);
  }
  for (const c of copies.values()) {
    if (c.count > DECK_RULES.MAX_COPIES)
      return `Maximum ${DECK_RULES.MAX_COPIES} exemplaires de « ${c.name} »`;
  }

  const missing = entries.find((e) => e.quantity > e.owned);
  if (missing)
    return `Tu ne possèdes plus assez d'exemplaires de « ${missing.cardName} »`;

  return null;
}
