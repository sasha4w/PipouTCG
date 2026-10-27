import { Rarity, RARITY_RANK } from "../enums";

/** Nombre de cartes à fournir pour forger une carte de rareté supérieure. */
export const FORGE_COST: Partial<Record<Rarity, number>> = {
  [Rarity.COMMON]: 10,
  [Rarity.UNCOMMON]: 10,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 15,
};

/** Poussière obtenue en détruisant une carte, par rareté. */
export const DUST_VALUE: Record<Rarity, number> = {
  [Rarity.COMMON]: 1,
  [Rarity.UNCOMMON]: 3,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 30,
  [Rarity.LEGENDARY]: 100,
  [Rarity.SECRET]: 300,
};

export function isForgeable(rarity: Rarity): boolean {
  return FORGE_COST[rarity] !== undefined;
}

/** Rareté de la carte obtenue en forgeant, ou null si non forgeable. */
export function nextForgeRarity(rarity: Rarity): Rarity | null {
  if (!isForgeable(rarity)) return null;
  const target = RARITY_RANK[rarity] + 1;
  const next = (Object.keys(RARITY_RANK) as Rarity[]).find(
    (r) => RARITY_RANK[r] === target,
  );
  return next ?? null;
}
