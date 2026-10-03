import { api } from "../api/api";
import type { SandboxScenarioSummary } from "@pipou/shared";
import { cardService, type Card } from "./card.service";

export type { SandboxScenarioSummary };

export const sandboxService = {
  async listScenarios(): Promise<SandboxScenarioSummary[]> {
    const res = await api.get("/sandbox/scenarios");
    return res.data;
  },

  async deleteScenario(id: number): Promise<void> {
    await api.delete(`/sandbox/scenarios/${id}`);
  },

  /** Tout le catalogue ; 500 est le plafond de pagination de l'API. */
  async catalog(): Promise<Card[]> {
    const res = await cardService.findAll(1, 500);
    return res.data;
  },
};
