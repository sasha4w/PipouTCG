import { Card } from '../../cards/card.entity';

// ─── Base runtime instance ───────────────────────────────────────────────────

export interface CardInstance {
  instanceId: string;
  baseCard: Card;
  ownerId: number;
  currentHp?: number;
  atkBuff?: number;
  hpBuff?: number;
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
  tempAtkBuff: number;
  hasAttackedThisTurn: boolean;
  attacksPerTurn: number;
  attacksUsedThisTurn: number;
  hasTaunt: boolean;
  hasPiercing: boolean;
  isImmuneToDebuffs: boolean;
  forcedAttackMode: boolean;
  summonedThisTurn: boolean;
  doubleAtkNextTurn: boolean;
  damageReduction?: number;
}

// ─── Per-player state ────────────────────────────────────────────────────────

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
  source: 'graveyard' | 'deck';
}

export interface PendingChoice {
  forUserId: number;
  candidates: ChoiceCandidate[];
  /** How many cards the player must pick */
  count: number;
  prompt: string;
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
  /** Set when an effect requires the player to interactively pick a card */
  pendingChoice?: PendingChoice;
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
  freeSummonAvailable?: boolean;
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

/** Stripped-down candidate sent to the client (no full Card entity needed) */
export interface ClientChoiceCandidate {
  instanceId: string;
  baseCard: {
    id: number;
    name: string;
    type: string;
    atk: number;
    hp: number;
    rarity: string;
    supportType?: string | null;
  };
  source: 'graveyard' | 'deck';
}

export interface ClientPendingChoice {
  candidates: ClientChoiceCandidate[];
  count: number;
  prompt: string;
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
  /** Only present when this player has a card pick pending */
  pendingChoice?: ClientPendingChoice;
}
