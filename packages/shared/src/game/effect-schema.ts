import { CardType, SupportType } from "../enums/card";
import {
  ActionType as A,
  EffectConditionType as C,
  EffectTarget as T,
  EffectTrigger as Tr,
} from "../enums/effect";
import type { ActionType, EffectConditionType, EffectTarget, EffectTrigger } from "../enums/effect";
import type { CardEffect } from "./effect";

/** Champs optionnels d'une action, au-delà de `type` et `target`. */
export type ActionField = "value" | "duration" | "archetype" | "filter" | "valueIf";

export interface ActionSchema {
  fields: readonly ActionField[];
  targets: readonly EffectTarget[];
}

/** Cibles qui désignent des monstres (ni le joueur ni l'adversaire). */
const MONSTERS: readonly EffectTarget[] = [
  T.SELF,
  T.ALLY_MONSTER,
  T.ALL_ALLIES,
  T.ALLIES_EXCEPT_SELF,
  T.ENEMY_MONSTER,
  T.ALL_ENEMIES,
  T.ARCHETYPE_ALLIES,
  T.TARGET_ALLY,
  T.ADJACENT_ALLIES,
  T.STRONGEST_ENEMY,
];
const ALLIES: readonly EffectTarget[] = [
  T.SELF,
  T.ALLY_MONSTER,
  T.ALL_ALLIES,
  T.ALLIES_EXCEPT_SELF,
  T.ARCHETYPE_ALLIES,
  T.TARGET_ALLY,
  T.ADJACENT_ALLIES,
];
const ENEMIES: readonly EffectTarget[] = [
  T.ENEMY_MONSTER,
  T.ALL_ENEMIES,
  T.STRONGEST_ENEMY,
];
const SELF_ONLY: readonly EffectTarget[] = [T.SELF];
const PLAYER_ONLY: readonly EffectTarget[] = [T.PLAYER];

const s = (
  targets: readonly EffectTarget[],
  ...fields: ActionField[]
): ActionSchema => ({
  targets,
  // Le moteur lit l'archétype de l'action pour viser les monstres d'un archétype
  fields:
    targets.includes(T.ARCHETYPE_ALLIES) && !fields.includes("archetype")
      ? [...fields, "archetype"]
      : fields,
});

/**
 * Ce que chaque action accepte. Déduit des cartes réelles et du moteur ;
 * `Record<ActionType, …>` force à compléter la table pour toute nouvelle action.
 */
export const ACTION_SCHEMA: Record<ActionType, ActionSchema> = {
  [A.DEAL_DAMAGE]: s(MONSTERS, "value", "valueIf"),
  [A.HEAL]: s(ALLIES, "value", "valueIf"),
  [A.DRAW]: s([T.PLAYER, T.OPPONENT], "value", "valueIf"),
  [A.BUFF_ATK]: s(ALLIES, "value", "valueIf"),
  [A.BUFF_HP]: s(ALLIES, "value", "valueIf"),
  [A.BUFF_ATK_TEMP]: s(ALLIES, "value", "archetype", "valueIf"),
  [A.DESTROY_MONSTER]: s(MONSTERS),
  [A.RETURN_TO_HAND]: s(MONSTERS),
  [A.DISCARD]: s([T.PLAYER, T.OPPONENT], "value"),
  [A.SET_TAUNT]: s(SELF_ONLY, "value"),
  [A.SET_PIERCING]: s(SELF_ONLY, "value"),
  [A.SET_ATTACKS_PER_TURN]: s(SELF_ONLY, "value"),
  [A.SET_DEBUFF_IMMUNITY]: s(SELF_ONLY, "value"),
  [A.SET_DELAY_DOUBLE_ATK]: s(SELF_ONLY, "value"),
  [A.FORCE_ATTACK_MODE]: s(SELF_ONLY, "value"),
  [A.RETURN_FROM_GRAVEYARD]: s(PLAYER_ONLY, "value", "filter", "valueIf"),
  [A.RETURN_FROM_GRAVEYARD_OR_DECK]: s(PLAYER_ONLY, "value", "filter"),
  [A.SEARCH_DECK]: s(PLAYER_ONLY, "value", "filter"),
  [A.GAIN_RECYCLE_ENERGY]: s(PLAYER_ONLY, "value"),
  [A.SET_FREE_SUMMON]: s(PLAYER_ONLY, "value"),
  [A.SET_DAMAGE_REDUCTION]: s(SELF_ONLY, "value", "duration"),
  [A.BUFF_HP_PER_ADJACENT_ALLY]: s(SELF_ONLY, "value"),
  [A.SET_TURN_COUNTER]: s(SELF_ONLY, "value"),
  [A.RESET_TURN_COUNTER]: s(PLAYER_ONLY, "value"),
  [A.FORCE_ATTACK_MODE_ENEMY]: s(ENEMIES),
  [A.BLOCK_ATTACK]: s(ENEMIES, "value"),
  [A.FORCE_GUARD_LOCK_ENEMY]: s(ENEMIES),
  [A.CANNOT_ATTACK_ON_SUMMON_TURN]: s(SELF_ONLY),
  [A.SUMMONABLE_ON_ENEMY_SIDE]: s(SELF_ONLY),
  [A.SET_COMBAT_IMMUNITY]: s(ALLIES),
  [A.SET_DISINFECT_IMMUNITY]: s(SELF_ONLY),
  [A.SET_SUPPORT_DESTROY_IMMUNITY]: s(SELF_ONLY),
  [A.IGNORE_TAUNT]: s(SELF_ONLY),
  [A.SET_HATCH_COUNTER]: s(SELF_ONLY, "value", "filter"),
  [A.ADVANCE_HATCH]: s(ALLIES, "value"),
  [A.SUMMON_FROM_DECK]: s(PLAYER_ONLY, "filter"),
  [A.EVOLUTION_JOKER]: s(SELF_ONLY),
  [A.DUPLICATE_MONSTER]: s(ALLIES, "value"),
  [A.INSTANT_EVOLUTION]: s(SELF_ONLY),
  [A.ALLOW_EVOLUTION_THIS_TURN]: s(ALLIES),
  [A.VIRUS_ATK_DEBUFF]: s(SELF_ONLY, "value"),
  [A.REFLECT_DAMAGE]: s(SELF_ONLY, "value"),
  [A.RELEVE]: s(SELF_ONLY, "value"),
  [A.SUMMON_IF_ALL_ELEMENTS]: s(SELF_ONLY),
  [A.COPY_GRAVEYARD_EFFECTS]: s(PLAYER_ONLY),
  [A.SET_COMBAT_DESTRUCTION_IMMUNITY]: s(SELF_ONLY),
  [A.SET_SUPPORT_DEBUFF_IMMUNITY]: s(SELF_ONLY),
  [A.SET_MONSTER_DEBUFF_IMMUNITY]: s(SELF_ONLY),
  [A.SET_MONSTER_STATUS_IMMUNITY]: s(SELF_ONLY),
  [A.ADD_CHARGE_COUNTERS]: s(PLAYER_ONLY, "value"),
  [A.GRANT_EXTRA_ATTACK]: s(ALLIES, "value"),
  [A.TRANSFER_HALF_ATK]: s(PLAYER_ONLY, "filter"),
  [A.FORCE_EVOLVE]: s(PLAYER_ONLY, "filter"),
  [A.REQUIRES_CARD_ON_BOARD]: s(SELF_ONLY, "filter"),
};

/** Monstre, ou sous-type de support. */
export type CardKind = "monster" | SupportType;

export function cardKindOf(c: {
  type: CardType;
  supportType: SupportType | null | undefined;
}): CardKind {
  if (c.type === CardType.MONSTER) return "monster";
  return c.supportType ?? SupportType.EPHEMERAL;
}

const ALL_TRIGGERS = Object.values(Tr) as EffectTrigger[];

/** Déclencheurs que le moteur résout pour chaque sorte de carte. */
export const TRIGGERS_BY_KIND: Record<CardKind, readonly EffectTrigger[]> = {
  monster: ALL_TRIGGERS.filter(
    (t) => t !== Tr.ON_PLAY && t !== Tr.ON_RECYCLE && t !== Tr.ON_CHARGED,
  ),
  [SupportType.EPHEMERAL]: [Tr.ON_PLAY, Tr.ON_RECYCLE, Tr.ON_TURN_START, Tr.PASSIVE],
  [SupportType.EQUIPMENT]: [Tr.ON_PLAY, Tr.ON_TURN_START, Tr.PASSIVE],
  [SupportType.PERSISTENT]: [Tr.ON_PLAY, Tr.ON_TURN_START, Tr.ON_TURN_END, Tr.PASSIVE],
  [SupportType.CHARGE]: [Tr.ON_PLAY, Tr.ON_TURN_START, Tr.ON_CHARGED, Tr.PASSIVE],
};

/** Champs de `EffectCondition` utilisés par chaque type de condition. */
export const CONDITION_FIELDS: Record<
  EffectConditionType,
  readonly ("value" | "match" | "element" | "stage")[]
> = {
  [C.ARCHETYPE_ON_BOARD]: ["value"],
  [C.HP_BELOW]: ["value"],
  [C.HAND_SIZE_MIN]: ["value"],
  [C.OPPONENT_HAS_NO_MONSTERS]: [],
  [C.SPECIFIC_CARD_ON_BOARD]: ["value", "match"],
  [C.EQUIPPED_ON]: ["value", "element", "stage"],
  [C.DRAKON_ON_BOARD]: ["element", "stage"],
};

export interface EffectIssue {
  effect: number;
  action?: number;
  code:
    | "trigger_not_allowed"
    | "target_not_allowed"
    | "no_actions"
    | "unknown_action";
}

/** Problèmes bloquants d'une liste d'effets pour une sorte de carte. */
export function validateEffects(
  kind: CardKind,
  effects: readonly CardEffect[],
): EffectIssue[] {
  const issues: EffectIssue[] = [];
  effects.forEach((e, effect) => {
    if (!TRIGGERS_BY_KIND[kind].includes(e.trigger))
      issues.push({ effect, code: "trigger_not_allowed" });
    if (e.actions.length === 0) issues.push({ effect, code: "no_actions" });
    e.actions.forEach((a, action) => {
      const schema: ActionSchema | undefined = ACTION_SCHEMA[a.type];
      if (!schema) issues.push({ effect, action, code: "unknown_action" });
      else if (!schema.targets.includes(a.target))
        issues.push({ effect, action, code: "target_not_allowed" });
    });
  });
  return issues;
}
