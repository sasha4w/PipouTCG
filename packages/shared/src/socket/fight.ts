import type { CombatMode } from "../game/instance";
import type { ClientGameState, GameEndReason } from "../game/state";

/** Namespace Socket.io du combat (FightsGateway). */
export const FIGHT_NAMESPACE = "/fight";

// ─── Client → serveur ─────────────────────────────────────────────────────────

export type EmptyPayload = Record<string, never>;

export interface MatchPayload {
  matchId: number;
}

export interface SubmitDeckPayload {
  matchId: number;
  deckId: number;
}

export interface SummonPayload {
  matchId: number;
  handIndex: number;
  zoneIndex: number;
  paymentHandIndices: number[];
}

export interface PlaySupportPayload {
  matchId: number;
  handIndex: number;
  zoneIndex?: number;
  targetInstanceId?: string;
}

export interface RecycleSupportPayload {
  matchId: number;
  handIndex: number;
}

export interface ChangeModePayload {
  matchId: number;
  instanceId: string;
  mode: CombatMode;
}

export interface AttackPayload {
  matchId: number;
  attackerInstanceId: string;
  targetInstanceId?: string;
  direct?: boolean;
}

export interface DiscardPayload {
  matchId: number;
  handIndex: number;
}

export interface PickCardsPayload {
  matchId: number;
  instanceIds: string[];
}

export interface ClientToServerEvents {
  "fight:queue": (payload?: EmptyPayload) => void;
  "fight:dequeue": (payload?: EmptyPayload) => void;
  "fight:test_match": (payload?: EmptyPayload) => void; // le deck est soumis ensuite
  "fight:submit_deck": (payload: SubmitDeckPayload) => void;
  "fight:submit_deck_test_p2": (payload: SubmitDeckPayload) => void;
  "fight:end_phase": (payload: MatchPayload) => void;
  "fight:summon": (payload: SummonPayload) => void;
  "fight:summon_opponent": (payload: SummonPayload) => void;
  "fight:play_support": (payload: PlaySupportPayload) => void;
  "fight:recycle_support": (payload: RecycleSupportPayload) => void;
  "fight:change_mode": (payload: ChangeModePayload) => void;
  "fight:attack": (payload: AttackPayload) => void;
  "fight:discard": (payload: DiscardPayload) => void;
  "fight:pick_cards": (payload: PickCardsPayload) => void;
  "fight:surrender": (payload: MatchPayload) => void;
}

// ─── Serveur → client ─────────────────────────────────────────────────────────

export interface MessagePayload {
  message: string;
}

export interface MatchFoundPayload {
  matchId: number;
  opponentName: string;
}

export interface TestMatchFoundPayload extends MatchFoundPayload {
  p2UserId: number;
}

export interface GameOverPayload {
  winner: number;
  endReason: GameEndReason;
}

export interface ServerToClientEvents {
  "fight:queued": (payload: MessagePayload) => void;
  "fight:dequeued": () => void;
  "fight:matched": (payload: MatchFoundPayload) => void;
  "fight:test_matched": (payload: TestMatchFoundPayload) => void;
  "fight:deck_accepted": (payload: MatchPayload) => void;
  "fight:state": (state: ClientGameState) => void;
  "fight:game_over": (payload: GameOverPayload) => void;
  "fight:error": (payload: MessagePayload) => void;
}
