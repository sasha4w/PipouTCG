import { api } from "../api/api";

export const QuestResetType = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  EVENT: "EVENT",
} as const;
export type QuestResetType =
  (typeof QuestResetType)[keyof typeof QuestResetType];

export const RewardType = {
  GOLD: "GOLD",
  BOOSTER: "BOOSTER",
  BUNDLE: "BUNDLE",
} as const;
export type RewardType = (typeof RewardType)[keyof typeof RewardType];

export const ConditionType = {
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
export type ConditionType = (typeof ConditionType)[keyof typeof ConditionType];

export const ConditionOperator = {
  AND: "AND",
  OR: "OR",
} as const;
export type ConditionOperator =
  (typeof ConditionOperator)[keyof typeof ConditionOperator];

export interface QuestCondition {
  type: ConditionType;
  amount?: number;
  rarity?: string;
  setId?: number;
  boosterId?: number;
  level?: number;
}

export interface QuestConditionGroup {
  operator: ConditionOperator;
  conditions: QuestCondition[];
}

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

export interface UserQuest {
  id: number;
  questId: number;
  title: string;
  description?: string;
  resetType: QuestResetType;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: number;
  progress: any;
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

export interface CreateQuestData {
  title: string;
  description?: string;
  resetType: QuestResetType;
  resetHour?: number;
  resetDayOfWeek?: number;
  endDate?: string;
  conditionGroup: QuestConditionGroup;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: number;
  isActive?: boolean;
}

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

  async update(id: number, data: Partial<CreateQuestData>): Promise<Quest> {
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
