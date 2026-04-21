import { Card } from '../../cards/card.entity';

// ─── Base runtime instance ───────────────────────────────────────────────────

export interface CardInstance {
  /** Unique runtime identifier */
  instanceId: string;

  /** Static reference (DB card) */
  baseCard: Card;

  /** Owner of this instance */
  ownerId: number;

  /** Runtime mutable stats */
  currentHp?: number;
  atkBuff?: number;
  hpBuff?: number;

  /** Future-proof status system (poison, stun, etc.) */
  status?: string[];
}

// ─── Board pieces ────────────────────────────────────────────────────────────

export type CombatMode = 'attack' | 'guard';

export interface MonsterOnBoard {
  /** Same as card.instanceId but duplicated for quick access */
  instanceId: string;

  /** Full instance (NOT raw Card) */
  card: CardInstance;

  /** Current HP (can diverge from baseCard.hp) */
  currentHp: number;

  mode: CombatMode;

  /** Attached equipments (instances) */
  equipments: CardInstance[];

  /** Buffs calculated dynamically */
  atkBuff: number;
  hpBuff: number;

  /** Turn state */
  hasAttackedThisTurn: boolean;
}

// ─── Per-player state ────────────────────────────────────────────────────────

export interface PlayerGameState {
  userId: number;
  username: string;
  socketId: string;

  // ── Core resources ──

  primes: number;

  /** Face-down life cards */
  primeDeck: CardInstance[];

  // ── Zones ──

  hand: CardInstance[];
  deck: CardInstance[];
  graveyard: CardInstance[];
  banished: CardInstance[];

  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];

  // ── Mechanics ──

  recycleEnergy: number;

  hasDrawnThisTurn: boolean;
  handLimitEnforced: boolean;

  ready: boolean;
}

// ─── Game state ──────────────────────────────────────────────────────────────

export type GamePhase =
  | 'waiting'
  | 'draw'
  | 'main'
  | 'battle'
  | 'end'
  | 'finished';

export type GameEndReason =
  | 'primes_depleted'
  | 'deck_empty'
  | 'surrender'
  | 'disconnect';

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
}

// ─── Client-safe views ───────────────────────────────────────────────────────

export interface MyClientState {
  userId: number;
  username: string;

  primes: number;

  hand: CardInstance[];
  deckCount: number;

  graveyard: CardInstance[];
  banished: CardInstance[];

  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];

  recycleEnergy: number;
}

export interface OpponentClientState {
  userId: number;
  username: string;

  primes: number;

  handCount: number;
  deckCount: number;

  graveyard: CardInstance[];
  banished: CardInstance[];

  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
}

export interface ClientGameState {
  matchId: number;

  phase: GamePhase;
  turnNumber: number;
  isMyTurn: boolean;

  me: MyClientState;
  opponent: OpponentClientState;

  log: string[];

  winner?: number;
  endReason?: GameEndReason;
}
