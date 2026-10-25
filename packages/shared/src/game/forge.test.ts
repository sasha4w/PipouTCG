import { describe, expect, it } from "vitest";
import { DUST_VALUE, FORGE_COST, isForgeable, nextForgeRarity } from "./forge";
import { Rarity } from "../enums";

describe("FORGE_COST", () => {
  it("vaut 10, 10, 10, 15 et exclut legendary/secret", () => {
    expect(FORGE_COST[Rarity.COMMON]).toBe(10);
    expect(FORGE_COST[Rarity.UNCOMMON]).toBe(10);
    expect(FORGE_COST[Rarity.RARE]).toBe(10);
    expect(FORGE_COST[Rarity.EPIC]).toBe(15);
    expect(Rarity.LEGENDARY in FORGE_COST).toBe(false);
    expect(Rarity.SECRET in FORGE_COST).toBe(false);
  });
});

describe("DUST_VALUE", () => {
  it("suit l'ordre des raretés", () => {
    expect([
      Rarity.COMMON,
      Rarity.UNCOMMON,
      Rarity.RARE,
      Rarity.EPIC,
      Rarity.LEGENDARY,
      Rarity.SECRET,
    ].map((r) => DUST_VALUE[r])).toEqual([1, 3, 10, 30, 100, 300]);
  });
});

describe("nextForgeRarity", () => {
  it("donne la rareté supérieure ou null", () => {
    expect(nextForgeRarity(Rarity.COMMON)).toBe(Rarity.UNCOMMON);
    expect(nextForgeRarity(Rarity.EPIC)).toBe(Rarity.LEGENDARY);
    expect(nextForgeRarity(Rarity.LEGENDARY)).toBeNull();
    expect(nextForgeRarity(Rarity.SECRET)).toBeNull();
    expect(isForgeable(Rarity.EPIC)).toBe(true);
    expect(isForgeable(Rarity.LEGENDARY)).toBe(false);
  });
});
