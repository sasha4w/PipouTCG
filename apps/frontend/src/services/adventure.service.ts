import { api } from "../api/api";
import type { AdventureOverview } from "@pipou/shared";

export const adventureService = {
  /** Mondes, IA et progression du joueur, avec le compteur de farm du jour. */
  async getOverview(): Promise<AdventureOverview> {
    const res = await api.get<AdventureOverview>("/adventure");
    return res.data;
  },
};
