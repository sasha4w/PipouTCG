import { describe, expect, it } from "vitest";
import { canSummonOnEnemySide, ephemeralTargetSide } from "./rules";

describe("ephemeralTargetSide", () => {
  it("détecte une cible adverse", () => {
    expect(
      ephemeralTargetSide([
        {
          trigger: "ON_PLAY",
          actions: [{ type: "DESTROY_MONSTER", target: "ENEMY_MONSTER" }],
        },
      ]),
    ).toBe("enemy");
  });

  it("détecte une cible alliée", () => {
    expect(
      ephemeralTargetSide([
        {
          trigger: "ON_PLAY",
          actions: [{ type: "HEAL", target: "TARGET_ALLY", value: 600 }],
        },
      ]),
    ).toBe("ally");
  });

  it("ignore les effets hors ON_PLAY et les cibles collectives", () => {
    expect(
      ephemeralTargetSide([
        { trigger: "PASSIVE", actions: [{ type: "HEAL", target: "TARGET_ALLY" }] },
        {
          trigger: "ON_PLAY",
          actions: [{ type: "BUFF_ATK_TEMP", target: "ALL_ALLIES" }],
        },
      ]),
    ).toBeNull();
  });
});

describe("canSummonOnEnemySide", () => {
  it("vrai seulement avec le passif SUMMONABLE_ON_ENEMY_SIDE", () => {
    expect(
      canSummonOnEnemySide([
        {
          trigger: "PASSIVE",
          actions: [{ type: "SUMMONABLE_ON_ENEMY_SIDE", target: "SELF" }],
        },
      ]),
    ).toBe(true);
    expect(canSummonOnEnemySide(null)).toBe(false);
  });
});
