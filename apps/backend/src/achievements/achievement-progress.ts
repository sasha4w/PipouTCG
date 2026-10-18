import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TOTAL,
  ALL_SETS,
  ALL_WORLDS,
  type AchievementFamily,
  type AchievementTier,
  type AchievementsResponse,
} from '@pipou/shared';

export interface ClaimedTier {
  family: AchievementFamily;
  tier: AchievementTier;
}

export function buildAchievementsResponse(
  values: Record<AchievementFamily, number>,
  totalSets: number,
  claimed: ClaimedTier[],
  equippedTitle: AchievementFamily | null,
): AchievementsResponse {
  const isClaimed = (family: AchievementFamily, tier: AchievementTier) =>
    claimed.some((c) => c.family === family && c.tier === tier);

  const families = ACHIEVEMENTS.map((def) => {
    const value = values[def.family];
    const tiers = def.tiers.map((t) => {
      // TODO(adventure Task 9): ALL_WORLDS = nombre de mondes actifs (provisoire : inatteignable)
      const threshold =
        t.threshold === ALL_SETS
          ? totalSets
          : t.threshold === ALL_WORLDS
            ? Number.MAX_SAFE_INTEGER
            : t.threshold;
      return {
        tier: t.tier,
        threshold,
        reward: t.reward,
        reached: value >= threshold,
        claimed: isClaimed(def.family, t.tier),
      };
    });
    const claimedTiers = tiers.filter((t) => t.claimed);
    return {
      family: def.family,
      value,
      claimedTier: claimedTiers.at(-1)?.tier ?? null,
      tiers,
    };
  });

  return {
    families,
    unlocked: families.reduce(
      (n, f) => n + f.tiers.filter((t) => t.claimed).length,
      0,
    ),
    total: ACHIEVEMENT_TOTAL,
    equippedTitle,
  };
}
