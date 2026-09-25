export const QuestType = {
  DAILY: "DAILY",
  ACHIEVEMENT: "ACHIEVEMENT",
} as const;
export type QuestType = (typeof QuestType)[keyof typeof QuestType];

export const QuestResetType = {
  NONE: "NONE", // achievement one-shot, jamais reset
  DAILY: "DAILY", // reset chaque jour à resetHour
  WEEKLY: "WEEKLY", // reset un jour fixe de la semaine à resetHour
  MONTHLY: "MONTHLY", // reset le 1er du mois à resetHour
  EVENT: "EVENT",
} as const;
export type QuestResetType = (typeof QuestResetType)[keyof typeof QuestResetType];

export const QuestRewardType = {
  GOLD: "GOLD",
  BOOSTER: "BOOSTER",
  BUNDLE: "BUNDLE",
} as const;
export type QuestRewardType = (typeof QuestRewardType)[keyof typeof QuestRewardType];

export const QuestConditionType = {
  OPEN_BOOSTER: "OPEN_BOOSTER",
  BUY_CARD: "BUY_CARD",
  SELL_CARD: "SELL_CARD",
  BUY_BOOSTER: "BUY_BOOSTER",
  SELL_BOOSTER: "SELL_BOOSTER",
  OWN_CARD: "OWN_CARD",
  COMPLETE_SET: "COMPLETE_SET",
  REACH_LEVEL: "REACH_LEVEL",
  WIN_FIGHT: "WIN_FIGHT",
} as const;
export type QuestConditionType =
  (typeof QuestConditionType)[keyof typeof QuestConditionType];

export const ConditionOperator = {
  AND: "AND",
  OR: "OR",
} as const;
export type ConditionOperator =
  (typeof ConditionOperator)[keyof typeof ConditionOperator];
