import type { CombatMode } from "./instance";

/** Action de jeu envoyée au moteur pour un siège donné. */
export type GameAction =
  | { type: "mulligan"; redraw: boolean }
  | { type: "end_phase" }
  | {
      type: "summon";
      handIndex: number;
      zoneIndex: number;
      paymentHandIndices: number[];
      onOpponentSide?: boolean;
    }
  | {
      type: "play_support";
      handIndex: number;
      zoneIndex?: number;
      targetInstanceId?: string;
    }
  | { type: "recycle"; handIndex: number }
  | { type: "change_mode"; instanceId: string; mode: CombatMode }
  | {
      type: "attack";
      attackerInstanceId: string;
      targetInstanceId?: string;
      direct?: boolean;
    }
  | { type: "discard"; handIndex: number }
  | { type: "pick_cards"; instanceIds: string[] };
