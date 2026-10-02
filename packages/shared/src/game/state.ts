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
export type PendingChoiceResolution = "pick_to_hand" | "discard";

export type ChoiceSource = "graveyard" | "deck" | "board" | "hand";

export interface ClientChoiceCandidate {
  instanceId: string;
  baseCard: Pick<
    ClientCard,
    "id" | "name" | "type" | "atk" | "hp" | "rarity" | "supportType"
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
  primes: number;
  hand: CardInstance[];
  deckCount: number;
  graveyard: CardInstance[];
  banished: CardInstance[];
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: (CardInstance | null)[];
  recycleEnergy: number;
  /** Cartes de la main invocables gratuitement (instanceId). */
  freeSummonInstanceIds: string[];
  mulliganDone: boolean;
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
  winner?: number;
  endReason?: GameEndReason;
  pendingChoice?: ClientPendingChoice;
  /** L'adversaire doit résoudre un choix avant que la partie continue. */
  opponentChoosing: boolean;
}
