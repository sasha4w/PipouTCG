import type { AchievementFamily } from "../enums/achievement";
import type { FightEvent } from "./events";
import type { MatchEndReason } from "../enums/match";
import type { ClientCard } from "./card";
import type { CardInstance, MonsterOnBoard } from "./instance";

export type GamePhase =
  | "waiting"
  | "mulligan"
  | "main"
  | "battle"
  | "end"
  | "finished";

export type GameEndReason = MatchEndReason;

/**
 * - 'pick_to_hand' : récupère depuis le cimetière ou le deck
 * - 'discard'      : défausse depuis la main
 */
export type PendingChoiceResolution = "pick_to_hand" | "discard" | "summon_to_zone";

export type ChoiceSource = "graveyard" | "deck" | "board" | "hand";

export interface ClientChoiceCandidate {
  instanceId: string;
  baseCard: Pick<
    ClientCard,
    | "id"
    | "name"
    | "type"
    | "atk"
    | "hp"
    | "rarity"
    | "supportType"
    | "cost"
    | "image"
    | "description"
    | "element"
    | "stage"
  >;
  source: ChoiceSource;
}

export interface ClientPendingChoice {
  candidates: ClientChoiceCandidate[];
  count: number;
  prompt: string;
  resolution?: PendingChoiceResolution;
}

export interface MyClientState {
  userId: number;
  username: string;
  /** Titre équipé (famille de succès), absent en sandbox. */
  title?: AchievementFamily | null;
  primes: number;
  hand: CardInstance[];
  deckCount: number;
  graveyard: CardInstance[];
  banished: CardInstance[];
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  recycleEnergy: number;
  /** Transformation d'un Jeune/Adulte de la main déjà utilisée ce tour. */
  transformUsedThisTurn: boolean;
  /** Cartes de la main invocables gratuitement (instanceId). */
  freeSummonInstanceIds: string[];
  mulliganDone: boolean;
}

export interface OpponentClientState {
  userId: number;
  username: string;
  /** Titre équipé (famille de succès), absent en sandbox. */
  title?: AchievementFamily | null;
  primes: number;
  handCount: number;
  deckCount: number;
  graveyard: CardInstance[];
  banished: CardInstance[];
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  mulliganDone: boolean;
}

/** État de partie envoyé à un joueur (fight:state) : sans la main ni le deck adverses. */
export interface ClientGameState {
  matchId: number;
  phase: GamePhase;
  turnNumber: number;
  isMyTurn: boolean;
  me: MyClientState;
  opponent: OpponentClientState;
  log: string[];
  /** Événements produits par la dernière action (vide à la reconnexion). */
  events: FightEvent[];
  winner?: number;
  endReason?: GameEndReason;
  pendingChoice?: ClientPendingChoice;
  /** L'adversaire doit résoudre un choix avant que la partie continue. */
  opponentChoosing: boolean;
}
