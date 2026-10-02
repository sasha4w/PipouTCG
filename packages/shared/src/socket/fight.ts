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
  /** Invocation sur une zone adverse libre (cartes SUMMONABLE_ON_ENEMY_SIDE). */
  onOpponentSide?: boolean;
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

export interface MulliganPayload {
  matchId: number;
  /** true : la main est remélangée dans le deck et 5 cartes sont repiochées. */
  redraw: boolean;
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
  "fight:submit_deck": (payload: SubmitDeckPayload) => void;
  "fight:mulligan": (payload: MulliganPayload) => void;
  "fight:end_phase": (payload: MatchPayload) => void;
  "fight:summon": (payload: SummonPayload) => void;
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

export interface GameOverPayload {
  /** null = match nul. */
  winner: number | null;
  endReason: GameEndReason;
}

export interface ServerToClientEvents {
  "fight:queued": (payload: MessagePayload) => void;
  "fight:dequeued": () => void;
  "fight:matched": (payload: MatchFoundPayload) => void;
  "fight:deck_accepted": (payload: MatchPayload) => void;
  "fight:state": (state: ClientGameState) => void;
  "fight:game_over": (payload: GameOverPayload) => void;
  "fight:error": (payload: MessagePayload) => void;
}
