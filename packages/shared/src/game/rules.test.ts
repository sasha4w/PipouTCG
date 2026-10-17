import { describe, expect, it } from "vitest";
import {
  canSummonOnEnemySide,
  ephemeralTargetSide,
  isTargetableByEphemeral,
} from "./rules";
import type { CardEffect } from "./effect";

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
        {
          trigger: "PASSIVE",
          actions: [{ type: "HEAL", target: "TARGET_ALLY" }],
        },
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

describe("isTargetableByEphemeral", () => {
  const destroy = (target: "ENEMY_MONSTER" | "ALLY_MONSTER"): CardEffect[] => [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "DESTROY_MONSTER", target }],
    },
  ];
  const damage: CardEffect[] = [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "DEAL_DAMAGE", target: "ENEMY_MONSTER", value: 100 }],
    },
  ];
  const shielded = { isImmuneToDebuffs: false, supportDestroyImmune: true };

  it("refuse un monstre protégé pour un Éphémère destructeur", () => {
    expect(
      isTargetableByEphemeral(shielded, "enemy", destroy("ENEMY_MONSTER")),
    ).toBe(false);
    expect(
      isTargetableByEphemeral(shielded, "ally", destroy("ALLY_MONSTER")),
    ).toBe(false);
  });

  it("accepte un monstre protégé pour un Éphémère non destructeur", () => {
    expect(isTargetableByEphemeral(shielded, "enemy", damage)).toBe(true);
  });

  it("refuse un monstre insensible aux effets adverses côté ennemi seulement", () => {
    const magouille = { isImmuneToDebuffs: true };
    expect(isTargetableByEphemeral(magouille, "enemy", damage)).toBe(false);
    expect(isTargetableByEphemeral(magouille, "ally", damage)).toBe(true);
  });
});
