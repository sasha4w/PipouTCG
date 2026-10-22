import type { DrakonStage } from "../enums/card";
import type { ClientCard } from "./card";

/** Exemplaire d'une carte en partie. C = entité complète côté serveur. */
export interface CardInstance<C = ClientCard> {
  instanceId: string;
  baseCard: C;
  ownerId: number;
  currentHp?: number;
  atkBuff?: number;
  hpBuff?: number;
  status?: string[];
  /** Ordre de pose d'un terrain en zone Support (croissant sur la partie). */
  placedSeq?: number;
  /** Copie créée en jeu : disparaît au lieu d'aller au cimetière ou en main. */
  token?: boolean;
}

export type CombatMode = "attack" | "guard";

/** Bonus posés par des effets déclenchés : socle du recalcul des passifs. */
export interface MonsterPermanentStats {
  atk: number;
  hp: number;
  taunt: boolean;
  piercing: boolean;
  debuffImmune: boolean;
  damageReduction?: number;
  attacksPerTurn: number;
}

export interface MonsterOnBoard<C = ClientCard> {
  instanceId: string;
  card: CardInstance<C>;
  currentHp: number;
  mode: CombatMode;
  equipments: CardInstance<C>[];
  atkBuff: number;
  hpBuff: number;
  tempAtkBuff: number;
  perm: MonsterPermanentStats;
  hasAttackedThisTurn: boolean;
  attacksPerTurn: number;
  attacksUsedThisTurn: number;
  hasTaunt: boolean;
  hasPiercing: boolean;
  isImmuneToDebuffs: boolean;
  forcedAttackMode: boolean;
  summonedThisTurn: boolean;
  doubleAtkNextTurn: boolean;
  /** Attaques supplémentaires ce tour-ci (double attaque différée). */
  extraAttacksThisTurn: number;
  /** Ne peut pas attaquer le tour de son invocation (effet de carte). */
  cannotAttackOnSummonTurn: boolean;
  damageReduction?: number;
  turnCounter?: number;
  ownerUserId?: number;
  blockAttackTurns?: number;
  guardLocked?: boolean;
  /** Tours adverses tenus d'affilée en Garde (repasse en Attaque à GUARD_MAX_TURNS). */
  guardTurns?: number;
  /** Aucun dégât de combat jusqu'au début du prochain tour de son propriétaire. */
  combatImmune?: boolean;
  /** Zeta implanté : à l'abri de la désinfection jusqu'au prochain tour de son poseur. */
  disinfectImmune?: boolean;
  /** Une destruction directe venant d'une carte Support n'a pas d'effet (passif). */
  supportDestroyImmune?: boolean;
  /** Peut attaquer n'importe quel monstre malgré une Provocation (passif). */
  ignoresTaunt?: boolean;
  /** Tours restants avant éclosion (œuf). */
  hatchCounter?: number;
  /** Stade de la carte tirée du deck à l'éclosion. */
  hatchStage?: DrakonStage;
  /** Peut évoluer ce tour malgré le délai (effet). */
  canEvolveThisTurn?: boolean;
  /** Accepte un Jeune de n'importe quelle lignée (passif). */
  evolutionJoker?: boolean;
  /** Peut évoluer le tour où il est posé (passif). */
  instantEvolution?: boolean;
}
