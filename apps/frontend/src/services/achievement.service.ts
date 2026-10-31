import { api } from "../api/api";
import type {
  AchievementFamily,
  AchievementsResponse,
  ClaimAchievementResponse,
  ClaimAllAchievementsResponse,
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

  /** Réclame tous les paliers atteints, d'une famille ou de toutes. */
  async claimAll(family?: AchievementFamily): Promise<ClaimAllAchievementsResponse> {
    const res = await api.post("/achievements/claim-all", null, { params: { family } });
    return res.data;
  },

  async setTitle(family: AchievementFamily | null) {
    const body: SetTitleRequest = { family };
    const res = await api.put("/achievements/title", body);
    return res.data as { equippedTitle: AchievementFamily | null };
  },
};
