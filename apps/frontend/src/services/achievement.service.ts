import { api } from "../api/api";
import type {
  AchievementFamily,
  AchievementsResponse,
  ClaimAchievementResponse,
  SetTitleRequest,
} from "@pipou/shared";

export const achievementService = {
  async getMine(): Promise<AchievementsResponse> {
    const res = await api.get("/achievements");
    return res.data;
  },

  async claim(family: AchievementFamily): Promise<ClaimAchievementResponse> {
    const res = await api.post(`/achievements/${family}/claim`);
    return res.data;
  },

  async setTitle(family: AchievementFamily | null) {
    const body: SetTitleRequest = { family };
    const res = await api.put("/achievements/title", body);
    return res.data as { equippedTitle: AchievementFamily | null };
  },
};
