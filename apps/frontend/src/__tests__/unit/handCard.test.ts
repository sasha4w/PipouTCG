import { describe, expect, it } from "vitest";
import { toHandCard } from "../../features/fight/handCard";
import type { CardInstance } from "../../features/fight/fight.types";

describe("toHandCard", () => {
  it("conserve le stade d'un Drakon pour la règle d'évolution", () => {
    const instance = {
      instanceId: "i1",
      baseCard: {
        id: 110,
        name: "Jeune Feros",
        type: "monster",
        atk: 800,
        hp: 900,
        cost: 2,
        rarity: "rare",
        image: null,
        stage: "young",
      },
    } as unknown as CardInstance;

    expect(toHandCard(instance).stage).toBe("young");
  });

  it("met null pour une carte sans stade", () => {
    const instance = {
      instanceId: "i2",
      baseCard: {
        id: 1,
        name: "X",
        type: "monster",
        atk: 1,
        hp: 1,
        cost: 1,
        rarity: "common",
        image: null,
      },
    } as unknown as CardInstance;

    expect(toHandCard(instance).stage).toBeNull();
  });
});
