import type { AchievementFamily, AchievementTier } from "../enums/achievement";
import type { AchievementReward } from "../game/achievements";

export interface AchievementTierProgress {
  tier: AchievementTier;
  /** Seuil résolu (ALL_SETS remplacé par le nombre de sets). */
  threshold: number;
  reward: AchievementReward;
  reached: boolean;
  claimed: boolean;
}

export interface AchievementProgress {
  family: AchievementFamily;
  value: number;
  /** Plus haut palier réclamé. */
  claimedTier: AchievementTier | null;
  tiers: AchievementTierProgress[];
}

/** GET /achievements */
export interface AchievementsResponse {
  families: AchievementProgress[];
  unlocked: number;
  total: number;
  equippedTitle: AchievementFamily | null;
}

/** POST /achievements/:family/claim */
export interface ClaimAchievementResponse {
  family: AchievementFamily;
  tier: AchievementTier;
  reward: AchievementReward;
}

/** PUT /achievements/title */
export interface SetTitleRequest {
  family: AchievementFamily | null;
}
