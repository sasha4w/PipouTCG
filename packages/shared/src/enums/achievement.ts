// Valeurs stockées en base (user_achievement.family / .tier, user.equipped_title).
export const AchievementFamily = {
  BOOSTERS_OPENED: "BOOSTERS_OPENED",
  CARDS_BOUGHT: "CARDS_BOUGHT",
  CARDS_SOLD: "CARDS_SOLD",
  SETS_COMPLETED: "SETS_COMPLETED",
  DUELS_WON: "DUELS_WON",
  DUELS_PLAYED: "DUELS_PLAYED",
  LEVEL: "LEVEL",
  UNIQUE_CARDS: "UNIQUE_CARDS",
  HIGH_RARITY: "HIGH_RARITY",
  LOGIN_STREAK: "LOGIN_STREAK",
  GOLD_EARNED: "GOLD_EARNED",
  QUESTS_DONE: "QUESTS_DONE",
  ADVENTURE_WORLDS: "ADVENTURE_WORLDS",
  PVE_WON: "PVE_WON",
  PVE_PLAYED: "PVE_PLAYED",
} as const;
export type AchievementFamily =
  (typeof AchievementFamily)[keyof typeof AchievementFamily];

export const AchievementTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
} as const;
export type AchievementTier =
  (typeof AchievementTier)[keyof typeof AchievementTier];
