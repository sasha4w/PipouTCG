import { api } from "../api/api";
import type {
  AdminPuzzle,
  DailyPuzzleInfo,
  PuzzlePublishBody,
  PuzzleSaveBody,
  PuzzleScheduleBody,
  PuzzleScheduleEntry,
  PuzzleVerifyResult,
} from "@pipou/shared";

export const puzzleService = {
  /** Défi du jour, résolution du joueur et série. */
  async today(): Promise<DailyPuzzleInfo> {
    return (await api.get<DailyPuzzleInfo>("/puzzles/today")).data;
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  async adminList(): Promise<AdminPuzzle[]> {
    return (await api.get<AdminPuzzle[]>("/admin/puzzles")).data;
  },
  async update(id: number, body: PuzzleSaveBody): Promise<void> {
    await api.patch(`/admin/puzzles/${id}`, body);
  },
  async verify(id: number): Promise<PuzzleVerifyResult> {
    return (await api.post<PuzzleVerifyResult>(`/admin/puzzles/${id}/verify`)).data;
  },
  async publish(id: number, body: PuzzlePublishBody): Promise<void> {
    await api.post(`/admin/puzzles/${id}/publish`, body);
  },
  async unpublish(id: number): Promise<void> {
    await api.post(`/admin/puzzles/${id}/unpublish`);
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/admin/puzzles/${id}`);
  },
  async schedule(days = 14): Promise<PuzzleScheduleEntry[]> {
    return (
      await api.get<PuzzleScheduleEntry[]>("/admin/puzzles/schedule", { params: { days } })
    ).data;
  },
  async setSchedule(body: PuzzleScheduleBody): Promise<void> {
    await api.put("/admin/puzzles/schedule", body);
  },
  async toScenario(id: number): Promise<{ scenarioId: number }> {
    return (await api.post<{ scenarioId: number }>(`/admin/puzzles/${id}/scenario`)).data;
  },
};
