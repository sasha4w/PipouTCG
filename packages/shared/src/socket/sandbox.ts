import type { GameAction } from "../game/action";
import type { CardInstance, CombatMode } from "../game/instance";
import type { Seat } from "../game/seat";
import type { ClientGameState, GamePhase } from "../game/state";

/** Namespace Socket.io du sandbox admin (SandboxGateway). */
export const SANDBOX_NAMESPACE = "/sandbox";

/** Ligne d'un deck de sandbox : n'importe quelle carte du catalogue. */
export interface SandboxDeckEntry {
  cardId: number;
  quantity: number;
}

export interface SandboxCreatePayload {
  decks: Record<Seat, SandboxDeckEntry[]>;
  /** Joueur qui commence. */
  firstSeat: Seat;
  /** Timer de 90 s par phase (désactivé par défaut). */
  timer: boolean;
}

export interface SandboxActionPayload {
  seat: Seat;
  action: GameAction;
}

/** Destination d'une carte déplacée par l'admin. */
export type SandboxDestination =
  | { zone: "hand" }
  /** index 0 = dessus du deck (prochaine pioche). */
  | { zone: "deck"; index: number }
  | { zone: "graveyard" }
  | { zone: "monster"; index: number; mode: CombatMode }
  | { zone: "support"; index: number }
  | { zone: "equipment"; hostInstanceId: string };

/** Valeurs éditables d'un monstre posé (les bonus deviennent permanents). */
export interface SandboxMonsterPatch {
  currentHp?: number;
  atkBonus?: number;
  hpBonus?: number;
  mode?: CombatMode;
  taunt?: boolean;
  piercing?: boolean;
  debuffImmune?: boolean;
  /** null : retire la réduction de dégâts. */
  damageReduction?: number | null;
  attacksPerTurn?: number;
  /** null : retire le gel. */
  blockAttackTurns?: number | null;
  summonedThisTurn?: boolean;
}

/** Outils de mise en place : aucun effet déclenché, aucun coût. */
export type SandboxSetupCommand =
  | {
      type: "move_card";
      seat: Seat;
      instanceId: string;
      to: SandboxDestination;
    }
  | {
      type: "edit_monster";
      seat: Seat;
      instanceId: string;
      patch: SandboxMonsterPatch;
    }
  | {
      type: "edit_player";
      seat: Seat;
      patch: { primes?: number; recycleEnergy?: number };
    }
  | {
      type: "edit_game";
      patch: { phase?: GamePhase; turnNumber?: number; activeSeat?: Seat };
    };

export interface SandboxSavePayload {
  name: string;
  description?: string;
}

export interface SandboxLoadPayload {
  scenarioId: number;
}

/** État complet envoyé à l'admin : vue de chaque siège et decks ordonnés. */
export interface SandboxState {
  views: Record<Seat, ClientGameState>;
  /** Decks dans l'ordre de pioche (index 0 = prochaine carte). */
  decks: Record<Seat, CardInstance[]>;
  canUndo: boolean;
  canRedo: boolean;
  timer: boolean;
}

export interface SandboxClientEvents {
  "sandbox:create": (payload: SandboxCreatePayload) => void;
  "sandbox:action": (payload: SandboxActionPayload) => void;
  "sandbox:setup": (command: SandboxSetupCommand) => void;
  "sandbox:undo": () => void;
  "sandbox:redo": () => void;
  "sandbox:save": (payload: SandboxSavePayload) => void;
  "sandbox:load": (payload: SandboxLoadPayload) => void;
  "sandbox:close": () => void;
}

export interface SandboxServerEvents {
  "sandbox:state": (state: SandboxState) => void;
  "sandbox:closed": () => void;
  "sandbox:saved": (payload: { scenarioId: number }) => void;
  "sandbox:error": (payload: { message: string }) => void;
}

/** Scénario sauvegardé, tel que listé par GET /sandbox/scenarios. */
export interface SandboxScenarioSummary {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  updatedAt: string;
}
