import type {
  AchievementFamily,
  CardInstance as SharedCardInstance,
  ChoiceSource,
  FightEvent,
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
  title?: AchievementFamily | null;
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
  /** Transformation d'un Jeune/Adulte de la main déjà utilisée ce tour. */
  transformUsedThisTurn: boolean;
  hasDrawnThisTurn: boolean;
  handLimitEnforced: boolean;
  /** Cartes de la main invocables gratuitement (instanceId). */
  freeSummonInstanceIds: string[];
  ready: boolean;
  mulliganDone: boolean;
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
  /** summon_to_zone : le monstre vient d'un œuf, il peut évoluer le tour même. */
  fromEgg?: boolean;
  /** summon_to_zone : zone visée. */
  zoneIndex?: number;
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
  /** Choix à résoudre, dans l'ordre ; la partie attend tant qu'il en reste. */
  pendingChoices: PendingChoice[];
  /** Événements de la dernière action, vidés après chaque envoi d'état. */
  pendingEvents: FightEvent[];
  /** Dernier numéro d'ordre attribué à un terrain posé. */
  terrainSeq: number;
}
