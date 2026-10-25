import { AchievementFamily, AchievementTier } from "../enums/achievement";
import { QuestRewardType } from "../enums/quest";
import type { AchievementProgress, AchievementTierProgress } from "../api/achievements";

/** Seuil égal au nombre de sets existants, résolu par le back. */
export const ALL_SETS = "ALL_SETS" as const;
/** Seuil égal au nombre de mondes d'aventure actifs, résolu par le back. */
export const ALL_WORLDS = "ALL_WORLDS" as const;
export type AchievementThreshold = number | typeof ALL_SETS | typeof ALL_WORLDS;

export interface AchievementReward {
  type: QuestRewardType;
  amount: number;
  itemId?: number;
}

export interface AchievementTierDefinition {
  tier: AchievementTier;
  threshold: AchievementThreshold;
  reward: AchievementReward;
}

export interface AchievementDefinition {
  family: AchievementFamily;
  tiers: readonly [AchievementTierDefinition, AchievementTierDefinition, AchievementTierDefinition];
}

/** Booster « Brigade de Combat » et bundle « Tripack Escouade de combat ». */
export const ACHIEVEMENT_REWARD_BOOSTER_ID = 1;
export const ACHIEVEMENT_REWARD_BUNDLE_ID = 1;

const tiers = (
  bronze: AchievementThreshold,
  silver: AchievementThreshold,
  gold: AchievementThreshold,
): AchievementDefinition["tiers"] => [
  { tier: AchievementTier.BRONZE, threshold: bronze, reward: { type: QuestRewardType.GOLD, amount: 100 } },
  {
    tier: AchievementTier.SILVER,
    threshold: silver,
    reward: { type: QuestRewardType.BOOSTER, amount: 1, itemId: ACHIEVEMENT_REWARD_BOOSTER_ID },
  },
  {
    tier: AchievementTier.GOLD,
    threshold: gold,
    reward: { type: QuestRewardType.BUNDLE, amount: 1, itemId: ACHIEVEMENT_REWARD_BUNDLE_ID },
  },
];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { family: AchievementFamily.BOOSTERS_OPENED, tiers: tiers(10, 100, 500) },
  { family: AchievementFamily.CARDS_BOUGHT, tiers: tiers(5, 50, 250) },
  { family: AchievementFamily.CARDS_SOLD, tiers: tiers(5, 50, 250) },
  { family: AchievementFamily.CARDS_FORGED, tiers: tiers(1, 10, 50) },
  { family: AchievementFamily.CARDS_DESTROYED, tiers: tiers(10, 100, 500) },
  { family: AchievementFamily.SETS_COMPLETED, tiers: tiers(1, 3, ALL_SETS) },
  { family: AchievementFamily.DUELS_WON, tiers: tiers(1, 25, 100) },
  { family: AchievementFamily.DUELS_PLAYED, tiers: tiers(10, 50, 200) },
  { family: AchievementFamily.LEVEL, tiers: tiers(5, 15, 30) },
  { family: AchievementFamily.UNIQUE_CARDS, tiers: tiers(25, 100, 250) },
  { family: AchievementFamily.HIGH_RARITY, tiers: tiers(1, 10, 50) },
  { family: AchievementFamily.LOGIN_STREAK, tiers: tiers(7, 30, 100) },
  { family: AchievementFamily.GOLD_EARNED, tiers: tiers(1_000, 10_000, 100_000) },
  { family: AchievementFamily.QUESTS_DONE, tiers: tiers(10, 50, 200) },
  { family: AchievementFamily.ADVENTURE_WORLDS, tiers: tiers(1, 3, ALL_WORLDS) },
  { family: AchievementFamily.PVE_WON, tiers: tiers(5, 50, 200) },
  { family: AchievementFamily.PVE_PLAYED, tiers: tiers(10, 100, 300) },
];

export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length * 3;

export function findAchievement(family: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.family === family);
}

/** Premier palier non réclamé (les paliers se réclament dans l'ordre). */
export function nextAchievementTier(progress: AchievementProgress): AchievementTierProgress | null {
  return progress.tiers.find((t) => !t.claimed) ?? null;
}

export function isAchievementClaimable(progress: AchievementProgress): boolean {
  return nextAchievementTier(progress)?.reached ?? false;
}
