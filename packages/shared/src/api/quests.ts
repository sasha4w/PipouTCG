import type { Rarity } from "../enums/card";
import type {
  ConditionOperator,
  QuestConditionType,
  QuestResetType,
  QuestRewardType,
} from "../enums/quest";

export interface ConditionProgress {
  type: QuestConditionType;
  current: number;
  target: number;
  completed: boolean;
  rarity?: string;
  minRarity?: Rarity;
  setId?: number;
  boosterId?: number;
}

export interface QuestProgress {
  operator: ConditionOperator;
  conditions: ConditionProgress[];
  globalCompleted: boolean;
}

export interface UserQuest {
  id: number;
  questId: number;
  /** Clé i18n pour les quêtes du pool, texte libre pour les quêtes admin. */
  title: string;
  description: string | null;
  resetType: QuestResetType;
  rewardType: QuestRewardType;
  rewardAmount: number;
  rewardItemId: number | null;
  progress: QuestProgress;
  isCompleted: boolean;
  rewardClaimed: boolean;
  resetAt: string | null;
}

export const QUEST_LIST_KEYS = ["DAILY", "WEEKLY", "MONTHLY", "EVENT"] as const;
export type QuestListKey = (typeof QUEST_LIST_KEYS)[number];

/** GET /quests/me */
export type UserQuestsResponse = Record<QuestListKey, UserQuest[]> & {
  rerollAvailable: boolean;
  dailyResetAt: string;
  weeklyResetAt: string;
};
