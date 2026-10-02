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
  damageReduction?: number;
  turnCounter?: number;
  ownerUserId?: number;
  blockAttackTurns?: number;
  guardLocked?: boolean;
}
