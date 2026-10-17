import { describe, expect, it } from "vitest";
import { toHandCard } from "../../features/fight/handCard";
import type { CardInstance } from "../../features/fight/fight.types";

describe("toHandCard", () => {
  it("conserve l'élément d'un Drakon pour la pastille", () => {
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
        element: "fire",
      },
    } as unknown as CardInstance;

    expect(toHandCard(instance).element).toBe("fire");
  });

  it("met null pour une carte sans élément", () => {
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

    expect(toHandCard(instance).element).toBeNull();
  });
});
