import type {
  Archetype,
  CardType,
  DrakonElement,
  DrakonStage,
  Rarity,
} from "../enums/card";
import type {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from "../enums/effect";

/** Comparaison de noms de cartes : égalité, ou « contient » pour viser une série. */
export type CardNameMatch = "exact" | "contains";

export interface EffectCondition {
  type: EffectConditionType;
  /** Absent pour DRAKON_ON_BOARD. */
  value?: number | string;
  /** Conditions portant sur un nom de carte uniquement ("exact" par défaut). */
  match?: CardNameMatch;
  element?: DrakonElement;
  stage?: DrakonStage;
}

export interface EffectFilter {
  archetype?: Archetype;
  rarities?: Rarity[];
  type?: CardType;
  name?: string;
  /** Nom de carte exclu (exact, sans tenir compte des accents ni de la casse). */
  excludeName?: string;
  element?: DrakonElement;
  stage?: DrakonStage;
}

/** Valeur de remplacement quand la condition est remplie (ex. 2 cartes, 3 si Capitaine). */
export interface EffectValueIf {
  condition: EffectCondition;
  value: number;
}

export interface EffectAction {
  type: ActionType;
  target: EffectTarget;
  value?: number;
  /** Durée en tours du propriétaire, pour les effets qui s'éteignent (ex. dégâts divisés). */
  duration?: number;
  archetype?: string;
  filter?: EffectFilter;
  valueIf?: EffectValueIf;
}

export interface CardEffect {
  trigger: EffectTrigger;
  condition?: EffectCondition | null;
  actions: EffectAction[];
}
