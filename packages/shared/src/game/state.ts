import type { MatchEndReason } from "../enums/match";
import type { ClientCard } from "./card";
import type { CardInstance, MonsterOnBoard } from "./instance";

export type GamePhase = "waiting" | "draw" | "main" | "battle" | "end" | "finished";

export type GameEndReason = MatchEndReason;

/**
 * - 'pick_to_hand'      : récupère depuis cimetière/deck
 * - 'destroy_ally'      : détruit le monstre allié choisi (Formatage, Recyclage)
 * - 'return_to_hand'    : retourne le monstre allié + équipements en main (Migration)
 * - 'force_attack_enemy': force un monstre adverse en mode Attaque (Rootkit)
 */
export type PendingChoiceResolution =
  | "pick_to_hand"
  | "destroy_ally"
  | "return_to_hand"
  | "force_attack_enemy"
  | "block_attack_enemy"
  | "force_guard_enemy";

export type ChoiceSource = "graveyard" | "deck" | "board";

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
}
