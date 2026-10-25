import {
  CardEffect,
  FORGE_COST,
  isForgeable,
  nextForgeRarity,
  Rarity,
  requiresAllElements,
} from '@pipou/shared';

export interface ForgeCardInfo {
  id: number;
  rarity: Rarity;
  setId: number | null;
  effects: CardEffect[] | null;
}

export interface ForgeInput {
  card: ForgeCardInfo;
  quantity: number;
  /** Exemplaires disponibles (hors deck verrouillé, en vente, etc.). */
  usable: number;
}

/** Message d'erreur si la forge est invalide, sinon null. */
export function validateForge(
  inputs: ForgeInput[],
  target: ForgeCardInfo,
): string | null {
  if (inputs.length === 0) return 'Aucune carte sélectionnée pour la forge';
  if (inputs.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0))
    return 'Quantité invalide';

  const first = inputs[0].card;
  if (!isForgeable(first.rarity))
    return 'Cette rareté ne peut pas être forgée';
  if (inputs.some((i) => i.card.rarity !== first.rarity))
    return 'Toutes les cartes doivent avoir la même rareté';
  if (first.setId === null || inputs.some((i) => i.card.setId !== first.setId))
    return 'Toutes les cartes doivent appartenir au même set';

  const cost = FORGE_COST[first.rarity] as number;
  const total = inputs.reduce((sum, i) => sum + i.quantity, 0);
  if (total !== cost)
    return `La forge demande exactement ${cost} cartes (sélection actuelle : ${total})`;

  const used = new Map<number, { count: number; usable: number }>();
  for (const i of inputs) {
    const u = used.get(i.card.id) ?? { count: 0, usable: i.usable };
    u.count += i.quantity;
    used.set(i.card.id, u);
  }
  for (const u of used.values()) {
    if (u.count > u.usable)
      return "Tu ne possèdes pas assez d'exemplaires disponibles";
  }

  if (target.rarity !== nextForgeRarity(first.rarity))
    return 'La carte visée doit être exactement une rareté au-dessus';
  if (target.setId !== first.setId)
    return 'La carte visée doit appartenir au même set';
  if (requiresAllElements(target.effects))
    return 'Cette carte ne peut pas être forgée';

  return null;
}
