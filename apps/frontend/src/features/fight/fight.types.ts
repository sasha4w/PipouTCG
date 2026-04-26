export type Phase = "waiting" | "draw" | "main" | "battle" | "end" | "finished";
export type Tab = "fight" | "history" | "leaderboard";

export interface CardInstance {
  instanceId: string;
  baseCard: {
    id: number;
    name: string;
    type: string;
    atk: number;
    hp: number;
    cost: number;
    rarity: string;
    supportType?: string | null;
    archetype?: string | null;
    image?: { url: string } | null;
  };
  ownerId: number;
}

export interface MonsterOnBoard {
  instanceId: string;
  card: CardInstance;
  currentHp: number;
  mode: "attack" | "guard";
  equipments: { id: number; name: string }[];
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

export interface MyState {
  userId: number;
  username: string;
  primes: number;
  hand: CardInstance[];
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  recycleEnergy: number;
  graveyard: CardInstance[];
  banished: CardInstance[];
  /** Set by SET_FREE_SUMMON effect — Chevalier Touille can be summoned for free */
  freeSummonAvailable?: boolean;
}

export interface OppState {
  userId: number;
  username: string;
  primes: number;
  handCount: number;
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  graveyard: CardInstance[];
  banished: CardInstance[];
}

// ─── Pending card pick (deck search / graveyard retrieval) ────────────────────

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
  source: "graveyard" | "deck";
}

export interface PendingChoice {
  candidates: ClientChoiceCandidate[];
  count: number;
  prompt: string;
}

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  matchId: number;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  me: MyState;
  opponent: OppState;
  log: string[];
  winner?: number;
  endReason?: string;
  /** Present when an effect requires the player to pick card(s) */
  pendingChoice?: PendingChoice;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Card ID for Chevalier Touille (free summon target) */
export const FREE_SUMMON_CARD_ID = 29;

/** Card ID for Commandant Quenouille (can't attack turn summoned) */
export const QUENOUILLE_CARD_ID = 9;

export const RARITY_COLOR: Record<string, string> = {
  common: "#a8a8a8",
  uncommon: "#4fc1a6",
  rare: "#4a90d9",
  epic: "#9b59b6",
  legendary: "#f39c12",
  secret: "#e74c3c",
};

export const PHASE_LABEL: Record<Phase, string> = {
  waiting: "Attente",
  draw: "Pioche",
  main: "Principale",
  battle: "Combat",
  end: "Fin de tour",
  finished: "Terminé",
};

export const END_PHASE_LABEL: Record<string, string> = {
  main: "Phase de Combat →",
  battle: "Fin de Tour →",
  end: "Terminer le Tour →",
  draw: "Continuer →",
  waiting: "Continuer →",
  finished: "Continuer →",
};
