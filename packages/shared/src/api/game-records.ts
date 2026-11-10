import type { Archetype } from "../enums/card";
import type { MatchEndReason } from "../enums/match";
import type { Seat } from "../game/seat";

export type GameRecordMode = "pvp" | "pve";
/** Auteur d'une entrée de trace. */
export type GameRecordActor = "human" | "ai" | "timeout";

export interface GameRecordSeat {
  kind: "human" | "ai";
  /** Joueur humain ; absent pour l'IA. */
  userId?: number;
  /** Archétype dominant du deck (humain) ou celui de l'IA ; null si aucun. */
  archetype: Archetype | null;
  deck: { cardId: number; count: number }[];
  /** PvE : niveau de l'IA. */
  level?: number;
  /** PvE : adversaire d'aventure. */
  opponentId?: number;
}

/** Compteurs d'une carte (id de carte de base) pour un siège. */
export interface GameRecordCardStats {
  summoned?: number;
  supported?: number;
  evolved?: number;
  recycled?: number;
  /** Monstres adverses détruits, attribués à la carte qui agit. */
  kills?: number;
  destroyed?: number;
}

export interface GameRecordSummary {
  v: 1;
  mode: GameRecordMode;
  seats: Record<Seat, GameRecordSeat>;
  cards: Record<Seat, Record<number, GameRecordCardStats>>;
}

export interface GameRecordListItem {
  id: number;
  matchId: number;
  mode: GameRecordMode;
  player1Id: number;
  player2Id: number | null;
  winnerSeat: Seat | null;
  endReason: MatchEndReason | null;
  turns: number;
  moves: number;
  traceBytes: number;
  hasTrace: boolean;
  startedAt: string;
  endedAt: string;
  summary: GameRecordSummary;
}

export interface GameRecordPage {
  items: GameRecordListItem[];
  total: number;
  page: number;
}
