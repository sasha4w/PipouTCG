import { describe, expect, it } from "vitest";
import { ActionType, Immunity } from "../enums/effect";
import {
  EFFECT_IMMUNITIES,
  IMMUNITIES_BY_ACTION,
  blocksEnemyAction,
  hasImmunity,
} from "./immunity";

const m = (...immunities: Immunity[]) => ({ immunities });

describe("immunités", () => {
  it("l'ancienne immunité aux effets vaut les quatre immunités d'effets", () => {
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_DEBUFF_IMMUNITY]).toEqual(
      EFFECT_IMMUNITIES,
    );
    expect(EFFECT_IMMUNITIES).toHaveLength(4);
  });

  it("chaque action d'immunité donne son immunité", () => {
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_COMBAT_IMMUNITY]).toEqual([Immunity.COMBAT_DAMAGE]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY]).toEqual([Immunity.COMBAT_DESTRUCTION]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_MONSTER_STATUS_IMMUNITY]).toEqual([Immunity.MONSTER_STATUS]);
  });

  it("hasImmunity tolère un monstre sans liste", () => {
    expect(hasImmunity({}, Immunity.MONSTER_DEBUFF)).toBe(false);
    expect(hasImmunity(m(Immunity.MONSTER_DEBUFF), Immunity.MONSTER_DEBUFF)).toBe(true);
  });

  it("support : destruction vs reste", () => {
    const debuff = m(Immunity.SUPPORT_DEBUFF);
    expect(blocksEnemyAction(debuff, "support", ActionType.BLOCK_ATTACK)).toBe(true);
    expect(blocksEnemyAction(debuff, "support", ActionType.DESTROY_MONSTER)).toBe(false);
    const destroy = m(Immunity.SUPPORT_DESTRUCTION);
    expect(blocksEnemyAction(destroy, "support", ActionType.DESTROY_MONSTER)).toBe(true);
    expect(blocksEnemyAction(destroy, "support", ActionType.BLOCK_ATTACK)).toBe(false);
  });

  it("monstre : tout bloqué par MONSTER_DEBUFF", () => {
    expect(blocksEnemyAction(m(Immunity.MONSTER_DEBUFF), "monster", ActionType.DEAL_DAMAGE)).toBe(true);
    expect(blocksEnemyAction(m(Immunity.SUPPORT_DEBUFF), "monster", ActionType.DEAL_DAMAGE)).toBe(false);
  });
});
