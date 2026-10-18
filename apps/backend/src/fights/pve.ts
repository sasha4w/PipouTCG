import type { AdventureResultPayload } from '@pipou/shared';
import type { AiProfile } from './ai/ai-player';
import type {
  CardInstance,
  GameState,
} from './interfaces/game-state.interface';

/** Pause entre deux coups de l'IA, pour laisser voir animations et log. */
export const AI_ACTION_DELAY_MS = 2000;
/** Timeouts humains consécutifs avant la défaite. */
export const PVE_MAX_TIMEOUTS = 3;
/** Coups IA par tour au-delà desquels elle ne fait plus que finir ses phases. */
export const AI_MAX_ACTIONS_PER_TURN = 60;

/** Partie contre l'IA en cours dans FightsService. */
export interface PveInfo {
  adventureMatchId: number;
  opponentId: number;
  aiUserId: number;
  profile: AiProfile;
  /** Timeouts humains consécutifs (remis à 0 par toute action acceptée). */
  timeouts: number;
  /** Coups joués par l'IA dans le tour courant. */
  aiActionsThisTurn: number;
}

/** Ce que le mode Aventure fournit pour lancer un combat. */
export interface PveStart {
  adventureMatchId: number;
  opponentId: number;
  opponentName: string;
  profile: AiProfile;
  /** Deck de l'IA ; `ownerId` est renseigné par FightsService. */
  aiCards: CardInstance[];
}

/**
 * Persistance PvE, fournie par le module Aventure (jeton `PVE_HOOKS`) :
 * FightsService ne dépend pas de lui, ce qui évite l'import circulaire.
 */
export interface PveHooks {
  prepareStart(userId: number, opponentId: number): Promise<PveStart>;
  recordResult(game: GameState, pve: PveInfo): Promise<AdventureResultPayload>;
}

export const PVE_HOOKS = Symbol('PVE_HOOKS');
