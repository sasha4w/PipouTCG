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
  instanceId: string;
  card: CardInstance;
  currentHp: number;
  mode: CombatMode;
  equipments: CardInstance[];
  atkBuff: number;
  hpBuff: number;
  tempAtkBuff: number; // ← nouveau : buff temporaire (reset fin de tour, pas par recalculate)
  hasAttackedThisTurn: boolean;
  attacksPerTurn: number; // ← nouveau : défaut 1, Archer = 2
  attacksUsedThisTurn: number; // ← nouveau : compteur d'attaques ce tour
  hasTaunt: boolean; // ← nouveau : doit être détruit en premier
  hasPiercing: boolean; // ← nouveau : prime même si garde brisée
  isImmuneToDebuffs: boolean; // ← nouveau : Maître Magouille
  forcedAttackMode: boolean; // ← nouveau : Grossebouille ne peut pas passer en garde
  summonedThisTurn: boolean; // ← nouveau : Quenouille ne peut pas attaquer ce tour
  doubleAtkNextTurn: boolean; // ← nouveau : Quenouille double ATK tour suivant
  damageReduction?: number; // diviseur, ex: 2 = dégâts /2
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
  freeSummonAvailable?: boolean;
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
