export const Rarity = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
  SECRET: "secret",
} as const;
export type Rarity = (typeof Rarity)[keyof typeof Rarity];

export const CardType = {
  MONSTER: "monster",
  SUPPORT: "support",
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const SupportType = {
  EPHEMERAL: "EPHEMERAL",
  EQUIPMENT: "EQUIPMENT",
  PERSISTENT: "PERSISTENT",
  CHARGE: "CHARGE",
} as const;
export type SupportType = (typeof SupportType)[keyof typeof SupportType];

export const EquipmentSlot = {
  OFFENSIVE: "OFFENSIVE",
  DEFENSIVE: "DEFENSIVE",
  ACCESSORY: "ACCESSORY",
} as const;
export type EquipmentSlot = (typeof EquipmentSlot)[keyof typeof EquipmentSlot];

/** Équipements portables par monstre, par emplacement. */
export const EQUIP_SLOT_CAPACITY: Record<EquipmentSlot, number> = {
  [EquipmentSlot.OFFENSIVE]: 1,
  [EquipmentSlot.DEFENSIVE]: 1,
  [EquipmentSlot.ACCESSORY]: 2,
};

/** ONE_SHOT : se déclenche une fois puis part au cimetière. CYCLIC : pas encore géré. */
export const ChargeMode = {
  ONE_SHOT: "ONE_SHOT",
  CYCLIC: "CYCLIC",
} as const;
export type ChargeMode = (typeof ChargeMode)[keyof typeof ChargeMode];

export const Archetype = {
  PIPOU: "pipou",
  DRAGON: "dragon",
  PIXELMAN: "pixelman",
} as const;
export type Archetype = (typeof Archetype)[keyof typeof Archetype];

export const DrakonElement = {
  EARTH: "earth",
  FIRE: "fire",
  WIND: "wind",
  WATER: "water",
} as const;
export type DrakonElement = (typeof DrakonElement)[keyof typeof DrakonElement];

export const DrakonStage = {
  EGG: "egg",
  BABY: "baby",
  YOUNG: "young",
  ADULT: "adult",
  ANCESTRAL: "ancestral",
} as const;
export type DrakonStage = (typeof DrakonStage)[keyof typeof DrakonStage];

/** Rang de rareté : common = 0 … secret = 5. */
export const RARITY_RANK: Record<Rarity, number> = {
  [Rarity.COMMON]: 0,
  [Rarity.UNCOMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 3,
  [Rarity.LEGENDARY]: 4,
  [Rarity.SECRET]: 5,
};

export function rarityAtLeast(rarity: Rarity, min: Rarity): boolean {
  return RARITY_RANK[rarity] >= RARITY_RANK[min];
}
