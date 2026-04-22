export type Phase = "waiting" | "draw" | "main" | "battle" | "end" | "finished";
export type Tab = "fight" | "history" | "leaderboard";

export interface MonsterOnBoard {
  instanceId: string;
  card: {
    id: number;
    name: string;
    atk: number;
    hp: number;
    rarity: string;
    cost: number;
    image?: { url: string };
  };
  currentHp: number;
  mode: "attack" | "guard";
  equipments: { id: number; name: string }[];
  atkBuff: number;
  hpBuff: number;
  hasAttackedThisTurn: boolean;
}
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

export interface MyState {
  userId: number;
  username: string;
  primes: number;
  hand: CardInstance[]; // ✅ au lieu de l'objet à plat
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  recycleEnergy: number;
  graveyard: CardInstance[];
  banished: CardInstance[];
}

export interface OppState {
  userId: number;
  username: string;
  primes: number;
  handCount: number;
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: ({ id: number; name: string } | null)[];
  graveyard: { id: number; name: string }[];
  banished: { id: number; name: string }[];
}

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
}

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
