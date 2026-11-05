import { api } from "../api/api";
import type {
  Archetype,
  ClaimStarterBody,
  ClaimStarterResult,
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
};
