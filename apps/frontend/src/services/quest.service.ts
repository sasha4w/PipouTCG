import { api } from "../api/api";
import type {
  CreateQuestRequest,
  QuestCondition,
  QuestConditionGroup,
  UpdateQuestRequest,
} from "@pipou/shared";
import {
  ConditionOperator,
  QuestConditionType as ConditionType,
  QuestResetType,
  QuestRewardType as RewardType,
} from "@pipou/shared";

export { ConditionOperator, ConditionType, QuestResetType, RewardType };

export interface Quest {
  id: number;
  title: string;
  description?: string;
  resetType: QuestResetType;
  resetHour: number;
  resetDayOfWeek?: number;
  endDate?: string | null;
  conditionGroup: QuestConditionGroup;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: number;
  isActive: boolean;
}

/** Avancement d'une condition (miroir de ConditionProgress côté back). */
export interface ConditionProgress {
  type: ConditionType;
  current: number;
  target: number;
  completed: boolean;
  rarity?: string;
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
  title: string;
  description?: string;
  resetType: QuestResetType;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: number;
  progress: QuestProgress | null;
  isCompleted: boolean;
  rewardClaimed: boolean;
  resetAt: string | null;
}

export interface UserQuestsGrouped {
  DAILY: UserQuest[];
  WEEKLY: UserQuest[];
  MONTHLY: UserQuest[];
  EVENT: UserQuest[];
  ACHIEVEMENT: UserQuest[];
}

export type { QuestCondition, QuestConditionGroup };
export type CreateQuestData = CreateQuestRequest;

export const questService = {
  // USER
  async getMyQuests(): Promise<UserQuestsGrouped> {
    const res = await api.get("/quests/me");
    return res.data;
  },

  async claimReward(userQuestId: number) {
    const res = await api.post(`/quests/${userQuestId}/claim`);
    return res.data;
  },
  async claimAllRewards() {
    const res = await api.post(`/quests/claim-all`);
    return res.data;
  },

  // ADMIN
  async findAll(): Promise<Quest[]> {
    const res = await api.get("/quests");
    return res.data;
  },

  async findOne(id: number): Promise<Quest> {
    const res = await api.get(`/quests/${id}`);
    return res.data;
  },

  async create(data: CreateQuestData): Promise<Quest> {
    const res = await api.post("/quests", data);
    return res.data;
  },

  async update(id: number, data: UpdateQuestRequest): Promise<Quest> {
    const res = await api.patch(`/quests/${id}`, data);
    return res.data;
  },

  async toggleActive(id: number) {
    const res = await api.patch(`/quests/${id}/toggle`);
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/quests/${id}`);
    return res.data;
  },
};
