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
  /** Countdown pour autodestruction (Noyau Zeta). Undefined = pas de compteur. */
  turnCounter?: number;
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

// ─── Pending card pick ────────────────────────────────────────────────────────

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
  /** 'board' = monstre sur le terrain (destroy_ally / return_to_hand / force_attack_enemy) */
  source: "graveyard" | "deck" | "board";
}

/**
 * - 'pick_to_hand'      : récupère depuis cimetière/deck
 * - 'destroy_ally'      : détruit un allié sur le board (Formatage, Recyclage)
 * - 'return_to_hand'    : retourne un allié en main (Migration)
 * - 'force_attack_enemy': force un ennemi en mode Attaque (Rootkit)
 */
export type PendingChoiceResolution =
  | "pick_to_hand"
  | "destroy_ally"
  | "return_to_hand"
  | "force_attack_enemy";

export interface PendingChoice {
  candidates: ClientChoiceCandidate[];
  count: number;
  prompt: string;
  resolution?: PendingChoiceResolution;
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
  pendingChoice?: PendingChoice;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_SUMMON_CARD_ID = 29;
export const QUENOUILLE_CARD_ID = 9;

/** ID de Noyau Zeta — invocable sur zone adverse */
export const NOYAU_ZETA_CARD_ID = 122;

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
