import { api } from "../api/api";
import type {
  AiReviewAnnotation,
  AiReviewAnnotationRequest,
  AiReviewDecision,
  AiReviewDecisionSummary,
  AiReviewGame,
} from "@pipou/shared";

export type {
  AiReviewAnnotation,
  AiReviewAnnotationRequest,
  AiReviewDecision,
  AiReviewDecisionSummary,
  AiReviewGame,
};

export const aiReviewService = {
  async games(): Promise<AiReviewGame[]> {
    const res = await api.get("/admin/ai-review/games");
    return res.data;
  },

  async decisions(gameId: string): Promise<AiReviewDecisionSummary[]> {
    const res = await api.get(
      `/admin/ai-review/games/${encodeURIComponent(gameId)}/decisions`,
    );
    return res.data;
  },

  async decision(id: string): Promise<AiReviewDecision> {
    const res = await api.get(
      `/admin/ai-review/decisions/${encodeURIComponent(id)}`,
    );
    return res.data;
  },

  async annotate(
    id: string,
    body: AiReviewAnnotationRequest,
  ): Promise<AiReviewAnnotation> {
    const res = await api.post(
      `/admin/ai-review/decisions/${encodeURIComponent(id)}/annotations`,
      body,
    );
    return res.data;
  },
};
