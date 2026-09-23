import { api } from "../api/api";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type MatchEndReason =
  | "primes_depleted"
  | "deck_empty"
  | "surrender"
  | "disconnect";

export type MatchStatus = "in_progress" | "finished" | "abandoned";

export interface MatchPlayer {
  id: number;
  username: string;
}

export interface Match {
  id: number;
  player1: MatchPlayer;
  player2: MatchPlayer;
  winner: MatchPlayer | null;
  status: MatchStatus;
  endReason: MatchEndReason | null;
  totalTurns: number;
  startedAt: string;
  endedAt: string | null;
}

export interface PlayerStats {
  id: number;
  userId: number;
  wins: number;
  losses: number;
  draws: number;
  elo: number;
  user: MatchPlayer;
}

export interface PaginatedMatches {
  data: Match[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export const fightService = {
  /** Paginated match history for the authenticated user (newest first). */
  async getMyHistory(page = 1, limit = 20): Promise<PaginatedMatches> {
    const res = await api.get("/fights/history", { params: { page, limit } });
    return res.data;
  },

  /** Personal stats (wins, losses, ELO) for the authenticated user. */
  async getMyStats(): Promise<PlayerStats> {
    const res = await api.get("/fights/stats");
    return res.data;
  },

  /** Global leaderboard sorted by ELO descending. */
  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    const res = await api.get("/fights/leaderboard", { params: { limit } });
    return res.data;
  },
};
