import { api } from "../api/api";
import type {
  ClaimDailyResult,
  DailyRewardStatus,
  RescueStreakResult,
} from "@pipou/shared";

export const dailyRewardService = {
  async getStatus(): Promise<DailyRewardStatus> {
    const res = await api.get("/daily-reward/status");
    return res.data;
  },

  async claimDaily(): Promise<ClaimDailyResult> {
    const res = await api.post("/daily-reward/claim");
    return res.data;
  },

  async rescueStreak(): Promise<RescueStreakResult> {
    const res = await api.post("/daily-reward/rescue");
    return res.data;
  },

  async resetStreak(): Promise<{ message: string }> {
    const res = await api.post("/daily-reward/reset");
    return res.data;
  },
};
