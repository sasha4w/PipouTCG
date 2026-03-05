export enum QuestType {
  DAILY = 'DAILY',
  ACHIEVEMENT = 'ACHIEVEMENT',
}

export enum QuestResetType {
  NONE = 'NONE', // achievement one-shot, jamais reset
  DAILY = 'DAILY', // reset chaque jour à resetHour
  WEEKLY = 'WEEKLY', // reset un jour fixe de la semaine à resetHour
  MONTHLY = 'MONTHLY', // reset le 1er du mois à resetHour
}

export enum RewardType {
  GOLD = 'GOLD',
  BOOSTER = 'BOOSTER',
  BUNDLE = 'BUNDLE',
}

export enum ConditionType {
  OPEN_BOOSTER = 'OPEN_BOOSTER',
  BUY_CARD = 'BUY_CARD',
  SELL_CARD = 'SELL_CARD',
  OWN_CARD = 'OWN_CARD',
  COMPLETE_SET = 'COMPLETE_SET',
  REACH_LEVEL = 'REACH_LEVEL',
  WIN_FIGHT = 'WIN_FIGHT', // pour plus tard
}

export enum ConditionOperator {
  AND = 'AND',
  OR = 'OR',
}
