import type { Socket } from "socket.io-client";
import type {
  CardInstance,
  ClientToServerEvents,
  GamePhase,
  MonsterOnBoard,
  ServerToClientEvents,
} from "@pipou/shared";

// Types de jeu : contrat partagé avec le backend (@pipou/shared), sous les noms
// historiques de l'UI.
export type {
  CardInstance,
  ClientChoiceCandidate,
  ClientGameState as GameState,
  ClientPendingChoice as PendingChoice,
  MonsterOnBoard,
  MyClientState as MyState,
  OpponentClientState as OppState,
  PendingChoiceResolution,
} from "@pipou/shared";

export type Phase = GamePhase;

/** Socket du namespace /fight, typé par le contrat partagé avec le serveur. */
export type FightClientSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;
export type Tab = "fight" | "history" | "leaderboard" | "rules";

/** Contenu d'une zone du plateau : monstre ou carte support. */
export type BoardZone = MonsterOnBoard | CardInstance;

export const isMonsterZone = (zone: BoardZone): zone is MonsterOnBoard =>
  "card" in zone;

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
