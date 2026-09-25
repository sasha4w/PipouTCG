export const DailyRewardType = {
  GOLD: "gold",
  CARD: "card",
  BOOSTER: "booster",
  BUNDLE: "bundle",
} as const;
export type DailyRewardType = (typeof DailyRewardType)[keyof typeof DailyRewardType];
