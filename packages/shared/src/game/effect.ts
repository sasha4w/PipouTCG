import type { Archetype, CardType, Rarity } from "../enums/card";
import type {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from "../enums/effect";

export interface EffectCondition {
  type: EffectConditionType;
  value?: number | string;
}

export interface EffectFilter {
  archetype?: Archetype;
  rarities?: Rarity[];
  type?: CardType;
  name?: string;
}

export interface EffectAction {
  type: ActionType;
  target: EffectTarget;
  value?: number;
  archetype?: string;
  filter?: EffectFilter;
}

export interface CardEffect {
  trigger: EffectTrigger;
  condition?: EffectCondition | null;
  actions: EffectAction[];
}
