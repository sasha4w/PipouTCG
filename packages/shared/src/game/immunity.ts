import { ActionType, Immunity } from "../enums/effect";

export type SourceKind = "monster" | "support";

/** Les quatre immunités d'effets (« insensible aux effets adverses »). */
export const EFFECT_IMMUNITIES: readonly Immunity[] = [
  Immunity.SUPPORT_DESTRUCTION,
  Immunity.SUPPORT_DEBUFF,
  Immunity.MONSTER_DEBUFF,
  Immunity.MONSTER_STATUS,
];

export const IMMUNITIES_BY_ACTION: Partial<
  Record<ActionType, readonly Immunity[]>
> = {
  [ActionType.SET_COMBAT_IMMUNITY]: [Immunity.COMBAT_DAMAGE],
  [ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY]: [Immunity.COMBAT_DESTRUCTION],
  [ActionType.SET_SUPPORT_DESTROY_IMMUNITY]: [Immunity.SUPPORT_DESTRUCTION],
  [ActionType.SET_SUPPORT_DEBUFF_IMMUNITY]: [Immunity.SUPPORT_DEBUFF],
  [ActionType.SET_MONSTER_DEBUFF_IMMUNITY]: [Immunity.MONSTER_DEBUFF],
  [ActionType.SET_MONSTER_STATUS_IMMUNITY]: [Immunity.MONSTER_STATUS],
  [ActionType.SET_DEBUFF_IMMUNITY]: EFFECT_IMMUNITIES,
};

export function hasImmunity(
  monster: { immunities?: readonly Immunity[] },
  immunity: Immunity,
): boolean {
  return monster.immunities?.includes(immunity) ?? false;
}

/** Une action adverse (toujours négative) est-elle sans effet sur ce monstre ? */
export function blocksEnemyAction(
  monster: { immunities?: readonly Immunity[] },
  source: SourceKind,
  action: ActionType,
): boolean {
  if (source === "monster") return hasImmunity(monster, Immunity.MONSTER_DEBUFF);
  return hasImmunity(
    monster,
    action === ActionType.DESTROY_MONSTER
      ? Immunity.SUPPORT_DESTRUCTION
      : Immunity.SUPPORT_DEBUFF,
  );
}
