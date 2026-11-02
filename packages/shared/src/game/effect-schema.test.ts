import { describe, expect, it } from "vitest";
import { CardType, SupportType } from "../enums/card";
import { ActionType, EffectTarget, EffectTrigger } from "../enums/effect";
import {
  ACTION_SCHEMA,
  TRIGGERS_BY_KIND,
  cardKindOf,
  validateEffects,
} from "./effect-schema";

describe("effect-schema", () => {
  it("ACTION_SCHEMA covers every ActionType", () => {
    expect(Object.keys(ACTION_SCHEMA).sort()).toEqual(
      Object.values(ActionType).sort(),
    );
  });

  it("DEAL_DAMAGE never targets players", () => {
    const { targets } = ACTION_SCHEMA[ActionType.DEAL_DAMAGE];
    expect(targets).not.toContain(EffectTarget.PLAYER);
    expect(targets).not.toContain(EffectTarget.OPPONENT);
  });

  it("ON_CHARGED only for charge", () => {
    expect(TRIGGERS_BY_KIND[SupportType.CHARGE]).toContain(
      EffectTrigger.ON_CHARGED,
    );
    for (const [kind, triggers] of Object.entries(TRIGGERS_BY_KIND)) {
      if (kind !== SupportType.CHARGE)
        expect(triggers).not.toContain(EffectTrigger.ON_CHARGED);
    }
  });

  it("cardKindOf maps monsters and support subtypes", () => {
    expect(cardKindOf({ type: CardType.MONSTER, supportType: null })).toBe(
      "monster",
    );
    expect(
      cardKindOf({ type: CardType.SUPPORT, supportType: SupportType.CHARGE }),
    ).toBe(SupportType.CHARGE);
    expect(cardKindOf({ type: CardType.SUPPORT, supportType: null })).toBe(
      SupportType.EPHEMERAL,
    );
  });

  describe("validateEffects", () => {
    it("flags an effect without actions", () => {
      expect(
        validateEffects("monster", [
          { trigger: EffectTrigger.ON_SUMMON, actions: [] },
        ]),
      ).toEqual([{ effect: 0, code: "no_actions" }]);
    });

    it("flags a target the action cannot take", () => {
      expect(
        validateEffects("monster", [
          {
            trigger: EffectTrigger.ON_SUMMON,
            actions: [
              {
                type: ActionType.DEAL_DAMAGE,
                target: EffectTarget.PLAYER,
                value: 2,
              },
            ],
          },
        ]),
      ).toEqual([{ effect: 0, action: 0, code: "target_not_allowed" }]);
    });

    it("flags a trigger the card kind cannot use", () => {
      expect(
        validateEffects("monster", [
          {
            trigger: EffectTrigger.ON_CHARGED,
            actions: [
              { type: ActionType.DRAW, target: EffectTarget.PLAYER, value: 1 },
            ],
          },
        ]),
      ).toEqual([{ effect: 0, code: "trigger_not_allowed" }]);
    });

    it("accepts a valid effect", () => {
      expect(
        validateEffects("monster", [
          {
            trigger: EffectTrigger.ON_SUMMON,
            actions: [
              { type: ActionType.DRAW, target: EffectTarget.PLAYER, value: 1 },
            ],
          },
        ]),
      ).toEqual([]);
    });
  });
});
