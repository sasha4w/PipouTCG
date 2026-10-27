import { api } from "../api/api";
import type {
  DestroyRequest,
  DestroyResponse,
  ForgeRequest,
  ForgeResponse,
  UsableCard,
} from "@pipou/shared";

export type { DestroyRequest, DestroyResponse, ForgeRequest, ForgeResponse, UsableCard };

export const forgeService = {
  /** Copies utilisables (hors decks) par carte possédée. */
  async usable(): Promise<UsableCard[]> {
    const res = await api.get("/forge/usable");
    return res.data;
  },

  async forge(req: ForgeRequest): Promise<ForgeResponse> {
    const res = await api.post("/forge", req);
    return res.data;
  },

  async destroy(req: DestroyRequest): Promise<DestroyResponse> {
    const res = await api.post("/forge/destroy", req);
    return res.data;
  },
};
