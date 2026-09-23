import { api } from "../api/api";

export type RewardType = "gold" | "card" | "booster" | "bundle";

export interface DailyReward {
  type: RewardType;
  value: number;
  quantity: number;
  label: string | null;
  isMilestone: boolean;
}

export interface StreakStatus {
  streak: {
    current: number;
    longest: number;
    totalDays: number;
    cycleDay: number;
    weekNumber: number;
    lastClaimDate: string | null; // ← AJOUTER
  };
  alreadyClaimed: boolean;
  daysMissed: number;
  rescueAvailable: boolean;
  rescueCost: number | null;
  maxRescuable: number;
  nextReward: {
    type: RewardType;
    value: number;
    quantity: number;
    label: string | null;
  } | null;
  nextMilestone: {
    dayThreshold: number;
    daysRemaining: number;
    label: string | null;
  } | null;
}

export interface ClaimResult {
  status: "claimed" | "rescue_required";
  message: string;
  streak: {
    current: number;
    longest: number;
    totalDays: number;
    cycleDay: number;
  };
  rewards?: DailyReward[];
  rescue?: {
    daysMissed: number;
    maxRescuable: number;
    costPerScenario: number[];
  };
}

export const dailyRewardService = {
  async getStatus(): Promise<StreakStatus> {
    const res = await api.get("/daily-reward/status");
    return res.data;
  },

  async claimDaily(): Promise<ClaimResult> {
    const res = await api.post("/daily-reward/claim");
    return res.data;
  },

  async rescueStreak(
    daysToBuy: number,
  ): Promise<{ message: string; goldSpent: number; goldRemaining: number }> {
    const res = await api.post("/daily-reward/rescue", { daysToBuy });
    return res.data;
  },

  async resetStreak(): Promise<{ message: string }> {
    const res = await api.post("/daily-reward/reset");
    return res.data;
  },
};
