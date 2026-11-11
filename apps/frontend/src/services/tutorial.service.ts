import { api } from "../api/api";
import type { TutorialOverview } from "@pipou/shared";

export const tutorialService = {
  /** Leçons du tutoriel, avec celles déjà terminées par le joueur. */
  async getOverview(): Promise<TutorialOverview> {
    const res = await api.get<TutorialOverview>("/tutorial");
    return res.data;
  },
};
