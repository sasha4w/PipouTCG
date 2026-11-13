import type { PuzzleObjectiveView, PuzzleReward } from "../api/puzzles";
import type { GameAction } from "../game/action";
import type { ClientGameState } from "../game/state";

/** Namespace Socket.io du défi du jour (PuzzleGateway). */
export const PUZZLE_NAMESPACE = "/puzzle";

export type PuzzleOutcome = "ongoing" | "solved" | "failed";

export interface PuzzleStartPayload {
  /** Admin seulement : teste ce défi (aucune récompense). Absent : défi du jour. */
  puzzleId?: number;
}

export interface PuzzleState {
  puzzleId: number;
  view: ClientGameState;
  objective: PuzzleObjectiveView;
  outcome: PuzzleOutcome;
  /** Présent une fois, sur l'état qui annonce la résolution du défi du jour. */
  reward?: PuzzleReward;
  /** Partie de test admin : rien n'est versé. */
  test: boolean;
}

export interface PuzzleClientEvents {
  "puzzle:start": (payload: PuzzleStartPayload) => void;
  "puzzle:action": (action: GameAction) => void;
  "puzzle:restart": () => void;
  "puzzle:close": () => void;
}

export interface PuzzleServerEvents {
  "puzzle:state": (state: PuzzleState) => void;
  "puzzle:closed": () => void;
  "puzzle:error": (payload: { message: string }) => void;
}
