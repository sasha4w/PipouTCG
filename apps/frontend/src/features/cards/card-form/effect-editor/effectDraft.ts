import {
  ACTION_SCHEMA,
  ActionType,
  CONDITION_FIELDS,
  TRIGGERS_BY_KIND,
} from "@pipou/shared";
import type {
  CardEffect,
  CardKind,
  EffectAction,
  EffectCondition,
  EffectConditionType,
  EffectTrigger,
} from "@pipou/shared";

export function newEffect(kind: CardKind): CardEffect {
  const type = ActionType.DEAL_DAMAGE;
  return {
    trigger: TRIGGERS_BY_KIND[kind][0],
    actions: [{ type, target: ACTION_SCHEMA[type].targets[0], value: 1 }],
  };
}

/** Change le type d'action : retire les champs interdits, recadre la cible. */
export function setActionType(
  action: EffectAction,
  type: ActionType,
): EffectAction {
  const { targets, fields } = ACTION_SCHEMA[type];
  const next: EffectAction = {
    type,
    target: targets.includes(action.target) ? action.target : targets[0],
  };
  for (const f of fields) {
    if (action[f] !== undefined) Object.assign(next, { [f]: action[f] });
  }
  return next;
}

export function setTrigger(e: CardEffect, trigger: EffectTrigger): CardEffect {
  return { ...e, trigger };
}

export function setConditionType(
  c: EffectCondition,
  type: EffectConditionType,
): EffectCondition {
  const next: EffectCondition = { type };
  for (const f of CONDITION_FIELDS[type]) {
    if (c[f] !== undefined) Object.assign(next, { [f]: c[f] });
  }
  return next;
}

/** Clés d'une action que l'éditeur n'affiche pas (conservées telles quelles). */
export function advancedKeys(action: EffectAction): string[] {
  const shown = new Set<string>([
    "type",
    "target",
    ...(ACTION_SCHEMA[action.type]?.fields ?? []),
  ]);
  return Object.keys(action).filter((k) => !shown.has(k));
}
