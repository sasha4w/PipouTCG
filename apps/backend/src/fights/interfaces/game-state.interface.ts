import type {
  CardInstance as SharedCardInstance,
  ChoiceSource,
  GameEndReason,
  GamePhase,
  MonsterOnBoard as SharedMonsterOnBoard,
  PendingChoiceResolution,
} from '@pipou/shared';
import { Card } from '../../cards/card.entity';

export type {
  ClientChoiceCandidate,
  ClientGameState,
  ClientPendingChoice,
  CombatMode,
  GameEndReason,
  GamePhase,
  MyClientState,
  OpponentClientState,
  PendingChoiceResolution,
} from '@pipou/shared';

// ─── Base runtime instance (côté serveur : carte = entité complète) ─────────

export type CardInstance = SharedCardInstance<Card>;
export type MonsterOnBoard = SharedMonsterOnBoard<Card>;

// ─── Per-player state (jamais envoyé tel quel au client) ─────────────────────

export interface PlayerGameState {
  userId: number;
  username: string;
  socketId: string;
  primes: number;
  primeDeck: CardInstance[];
  hand: CardInstance[];
  deck: CardInstance[];
  graveyard: CardInstance[];
  banished: CardInstance[];
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  recycleEnergy: number;
  hasDrawnThisTurn: boolean;
  handLimitEnforced: boolean;
  freeSummonAvailable?: boolean;
  ready: boolean;
}

// ─── Interactive card pick ────────────────────────────────────────────────────

export interface ChoiceCandidate {
  instanceId: string;
  baseCard: Card;
  source: ChoiceSource;
}

export interface PendingChoice {
  forUserId: number;
  candidates: ChoiceCandidate[];
  count: number;
  prompt: string;
  resolution?: PendingChoiceResolution;
}

// ─── Game state ──────────────────────────────────────────────────────────────

export interface GameState {
  matchId: number;
  player1: PlayerGameState;
  player2: PlayerGameState;
  currentTurnUserId: number;
  phase: GamePhase;
  turnNumber: number;
  winner?: number;
  endReason?: GameEndReason;
  log: string[];
  pendingChoice?: PendingChoice;
}
