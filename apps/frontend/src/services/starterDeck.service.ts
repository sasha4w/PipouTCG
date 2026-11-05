import { api } from "../api/api";
import type {
  Archetype,
  ClaimStarterBody,
  ClaimStarterResult,
  StarterDeckBody,
  StarterDeckView,
  StarterStatus,
} from "@pipou/shared";

export const starterDeckService = {
  async getStatus(): Promise<StarterStatus> {
    const res = await api.get("/starter-decks");
    return res.data;
  },

  async claim(archetype: Archetype): Promise<ClaimStarterResult> {
    const body: ClaimStarterBody = { archetype };
    const res = await api.post("/starter-decks/claim", body);
    return res.data;
  },

  async adminList(): Promise<StarterDeckView[]> {
    const res = await api.get("/admin/starter-decks");
    return res.data;
  },

  async saveDeck(
    archetype: Archetype,
    body: StarterDeckBody,
  ): Promise<StarterDeckView> {
    const res = await api.put(`/admin/starter-decks/${archetype}`, body);
    return res.data;
  },
};
