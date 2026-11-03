import { describe, expect, it } from "vitest";
import {
  ACTION_SCHEMA,
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
  SupportType,
  TRIGGERS_BY_KIND,
} from "@pipou/shared";
import {
  advancedKeys,
  newEffect,
  setActionType,
  setConditionType,
} from "../../features/cards/card-form/effect-editor/effectDraft";

describe("effectDraft", () => {
  it("drops fields not allowed by new action type", () => {
    const out = setActionType(
      {
        type: ActionType.BUFF_ATK_TEMP,
        target: EffectTarget.SELF,
        value: 2,
        duration: 1,
        archetype: "pipou",
      },
      ActionType.SET_TAUNT,
    );
    const allowed = ["type", "target", ...ACTION_SCHEMA.SET_TAUNT.fields];
    expect(Object.keys(out).every((k) => allowed.includes(k))).toBe(true);
    expect(out.type).toBe(ActionType.SET_TAUNT);
    expect(out.value).toBe(2);
    expect(out.duration).toBeUndefined();
  });

  it("retargets when target no longer allowed", () => {
    const out = setActionType(
      { type: ActionType.HEAL, target: EffectTarget.PLAYER, value: 1 },
      ActionType.DEAL_DAMAGE,
    );
    expect(out.target).toBe(ACTION_SCHEMA.DEAL_DAMAGE.targets[0]);
  });

  it("newEffect uses a trigger of the card kind", () => {
    const e = newEffect(SupportType.CHARGE);
    expect(TRIGGERS_BY_KIND.CHARGE).toContain(e.trigger);
    expect(e.actions).toHaveLength(1);
  });

  it("setConditionType keeps only fields of the new type", () => {
    const out = setConditionType(
      { type: EffectConditionType.DRAKON_ON_BOARD, element: "fire", stage: "baby" },
      EffectConditionType.HP_BELOW,
    );
    expect(out).toEqual({ type: EffectConditionType.HP_BELOW });
  });

  it("advancedKeys does not throw on an unknown action type", () => {
    expect(
      advancedKeys({ type: "FUTURE" as ActionType, target: EffectTarget.SELF, value: 1 }),
    ).toEqual(["value"]);
  });

  it("newEffect first trigger for a monster is ON_SUMMON", () => {
    expect(newEffect("monster").trigger).toBe(EffectTrigger.ON_SUMMON);
  });
});
