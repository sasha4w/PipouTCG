import type { DrakonStage } from "../enums/card";
import type { Immunity } from "../enums/effect";
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
  immunities: Immunity[];
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
  /** Immunités actives (permanentes ∪ du tour ∪ passives), recalculées à chaque état. */
  immunities: Immunity[];
  forcedAttackMode: boolean;
  summonedThisTurn: boolean;
  doubleAtkNextTurn: boolean;
  /** Attaques supplémentaires ce tour-ci (double attaque différée). */
  extraAttacksThisTurn: number;
  /** Ne peut pas attaquer le tour de son invocation (effet de carte). */
  cannotAttackOnSummonTurn: boolean;
  damageReduction?: number;
  /** Débuts de tour du propriétaire restants avant la fin des dégâts divisés. */
  reductionTurns?: number;
  turnCounter?: number;
  ownerUserId?: number;
  blockAttackTurns?: number;
  guardLocked?: boolean;
  /** Tours adverses tenus d'affilée en Garde (repasse en Attaque à GUARD_MAX_TURNS). */
  guardTurns?: number;
  /** Vient de sortir de la Garde : pas de retour en Garde avant le prochain tour de son propriétaire. */
  guardCooldown?: boolean;
  /** Part (en %) des dégâts de combat subis renvoyée à l'attaquant. */
  reflectPercent?: number;
  /** Drakon des Origines : la carte avant copie des effets, rendue à la sortie du terrain. */
  originalCard?: CardInstance<C>;
  /** Immunités jusqu'au début du prochain tour du propriétaire (Bouclier de Fortune). */
  turnImmunities?: Immunity[];
  /** Zeta implanté : à l'abri de la désinfection jusqu'au prochain tour de son poseur. */
  disinfectImmune?: boolean;
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
