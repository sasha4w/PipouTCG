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
  /**
   * Countdown pour les monstres à autodestruction (ex: Noyau Zeta).
   * Décrémenté au début du tour du joueur propriétaire.
   * Quand il atteint 0 : Prime gagnée + destruction.
   * undefined = pas de compteur.
   */
  turnCounter?: number;
  /**
   * Identifiant du joueur qui a posé ce monstre.
   * Nécessaire pour Noyau Zeta : posé sur le terrain adverse mais le compteur
   * décrémente au tour du POSEUR, et c'est lui qui reçoit la Prime.
   * Undefined = propriétaire = le joueur dont c'est la zone (comportement normal).
   */
  ownerUserId?: number;
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
  source: 'graveyard' | 'deck' | 'board';
}

/**
 * - 'pick_to_hand'      : récupère depuis cimetière/deck (comportement existant)
 * - 'destroy_ally'      : détruit le monstre allié choisi (Formatage, Recyclage)
 * - 'return_to_hand'    : retourne le monstre allié + équipements en main (Migration)
 * - 'force_attack_enemy': force un monstre adverse en mode Attaque (Rootkit)
 */
export type PendingChoiceResolution =
  | 'pick_to_hand'
  | 'destroy_ally'
  | 'return_to_hand'
  | 'force_attack_enemy';

export interface PendingChoice {
  forUserId: number;
  candidates: ChoiceCandidate[];
  count: number;
  prompt: string;
  resolution?: PendingChoiceResolution;
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
  source: 'graveyard' | 'deck' | 'board';
}

export interface ClientPendingChoice {
  candidates: ClientChoiceCandidate[];
  count: number;
  prompt: string;
  resolution?: PendingChoiceResolution;
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
  pendingChoice?: ClientPendingChoice;
}
