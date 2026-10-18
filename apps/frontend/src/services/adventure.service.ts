import { api } from "../api/api";
import type {
  AdminAdventureDeckBody,
  AdminAdventureOpponentBody,
  AdminAdventureOverview,
  AdminAdventureSettingsBody,
  AdminAdventureWorld,
  AdminAdventureWorldBody,
  AdventureOverview,
} from "@pipou/shared";

export const adventureService = {
  /** Mondes, IA et progression du joueur, avec le compteur de farm du jour. */
  async getOverview(): Promise<AdventureOverview> {
    const res = await api.get<AdventureOverview>("/adventure");
    return res.data;
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  async adminOverview(): Promise<AdminAdventureOverview> {
    const res = await api.get<AdminAdventureOverview>("/admin/adventure");
    return res.data;
  },

  async createWorld(body: AdminAdventureWorldBody): Promise<AdminAdventureWorld> {
    const res = await api.post<AdminAdventureWorld>("/admin/adventure/worlds", body);
    return res.data;
  },

  async updateWorld(
    id: number,
    body: AdminAdventureWorldBody,
  ): Promise<AdminAdventureWorld> {
    const res = await api.patch<AdminAdventureWorld>(
      `/admin/adventure/worlds/${id}`,
      body,
    );
    return res.data;
  },

  async updateOpponent(
    id: number,
    body: AdminAdventureOpponentBody,
  ): Promise<AdminAdventureWorld> {
    const res = await api.patch<AdminAdventureWorld>(
      `/admin/adventure/opponents/${id}`,
      body,
    );
    return res.data;
  },

  async saveDeck(
    id: number,
    body: AdminAdventureDeckBody,
  ): Promise<AdminAdventureWorld> {
    const res = await api.put<AdminAdventureWorld>(
      `/admin/adventure/opponents/${id}/deck`,
      body,
    );
    return res.data;
  },

  async regenerateDeck(id: number): Promise<AdminAdventureWorld> {
    const res = await api.post<AdminAdventureWorld>(
      `/admin/adventure/opponents/${id}/deck/regenerate`,
    );
    return res.data;
  },

  async updateSettings(body: AdminAdventureSettingsBody): Promise<void> {
    await api.patch("/admin/adventure/settings", body);
  },
};
