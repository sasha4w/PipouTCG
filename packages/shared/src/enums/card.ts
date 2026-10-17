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
  TERRAIN: "TERRAIN",
} as const;
export type SupportType = (typeof SupportType)[keyof typeof SupportType];

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
} as const;
export type DrakonStage = (typeof DrakonStage)[keyof typeof DrakonStage];
