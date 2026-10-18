import { AchievementFamily, Rarity } from '@pipou/shared';

/** Raretés comptées par HIGH_RARITY. */
export const HIGH_RARITIES = [
  Rarity.EPIC,
  Rarity.LEGENDARY,
  Rarity.SECRET,
] as const;

/** Données brutes lues en base (les agrégats SQL arrivent parfois en chaîne). */
export interface AchievementSources {
  user: {
    boostersOpened: number;
    cardsBought: number;
    cardsSold: number;
    moneyEarned: number | string;
    questsCompleted: number;
  };
  level: number;
  fights: { wins: number; losses: number; draws: number } | null;
  longestStreak: number | null;
  uniqueCards: number;
  highRarity: number;
  sets: { total: number; owned: number }[];
}

export function toAchievementValues(
  src: AchievementSources,
): Record<AchievementFamily, number> {
  const f = src.fights ?? { wins: 0, losses: 0, draws: 0 };
  return {
    [AchievementFamily.BOOSTERS_OPENED]: src.user.boostersOpened,
    [AchievementFamily.CARDS_BOUGHT]: src.user.cardsBought,
    [AchievementFamily.CARDS_SOLD]: src.user.cardsSold,
    [AchievementFamily.SETS_COMPLETED]: src.sets.filter(
      (s) => s.total > 0 && s.owned >= s.total,
    ).length,
    [AchievementFamily.DUELS_WON]: f.wins,
    [AchievementFamily.DUELS_PLAYED]: f.wins + f.losses + f.draws,
    [AchievementFamily.LEVEL]: src.level,
    [AchievementFamily.UNIQUE_CARDS]: src.uniqueCards,
    [AchievementFamily.HIGH_RARITY]: src.highRarity,
    [AchievementFamily.LOGIN_STREAK]: src.longestStreak ?? 0,
    [AchievementFamily.GOLD_EARNED]: Number(src.user.moneyEarned),
    [AchievementFamily.QUESTS_DONE]: src.user.questsCompleted,
  };
}
