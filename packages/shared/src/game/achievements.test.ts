import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TOTAL,
  ALL_SETS,
  ALL_WORLDS,
  isAchievementClaimable,
  nextAchievementTier,
} from "./achievements";
import { AchievementFamily, AchievementTier } from "../enums/achievement";
import type { AchievementProgress } from "../api/achievements";
import { Rarity, rarityAtLeast } from "../enums/card";

describe("catalogue des succès", () => {
  it("couvre les 15 familles, 3 paliers chacune", () => {
    expect(ACHIEVEMENTS.map((a) => a.family).sort()).toEqual(
      Object.values(AchievementFamily).sort(),
    );
    for (const a of ACHIEVEMENTS) {
      expect(a.tiers.map((t) => t.tier)).toEqual([
        AchievementTier.BRONZE,
        AchievementTier.SILVER,
        AchievementTier.GOLD,
      ]);
    }
    expect(ACHIEVEMENT_TOTAL).toBe(45);
  });

  it("a des seuils numériques strictement croissants", () => {
    for (const a of ACHIEVEMENTS) {
      const nums = a.tiers
        .map((t) => t.threshold)
        .filter((t): t is number => typeof t === "number");
      for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it("n'utilise ALL_SETS que pour l'or de SETS_COMPLETED", () => {
    const uses = ACHIEVEMENTS.flatMap((a) =>
      a.tiers.filter((t) => t.threshold === ALL_SETS).map((t) => [a.family, t.tier]),
    );
    expect(uses).toEqual([[AchievementFamily.SETS_COMPLETED, AchievementTier.GOLD]]);
  });

  it("n'utilise ALL_WORLDS que pour l'or de ADVENTURE_WORLDS", () => {
    const uses = ACHIEVEMENTS.flatMap((a) =>
      a.tiers.filter((t) => t.threshold === ALL_WORLDS).map((t) => [a.family, t.tier]),
    );
    expect(uses).toEqual([[AchievementFamily.ADVENTURE_WORLDS, AchievementTier.GOLD]]);
  });

  it("définit les seuils PvE", () => {
    const th = (f: string) => ACHIEVEMENTS.find((a) => a.family === f)!.tiers.map((t) => t.threshold);
    expect(th(AchievementFamily.PVE_WON)).toEqual([5, 50, 200]);
    expect(th(AchievementFamily.PVE_PLAYED)).toEqual([10, 100, 300]);
    expect(th(AchievementFamily.ADVENTURE_WORLDS)).toEqual([1, 3, ALL_WORLDS]);
  });
});

const progress = (claimed: boolean[], reached: boolean[]): AchievementProgress => ({
  family: AchievementFamily.LEVEL,
  value: 0,
  claimedTier: null,
  tiers: [AchievementTier.BRONZE, AchievementTier.SILVER, AchievementTier.GOLD].map(
    (tier, i) => ({
      tier,
      threshold: (i + 1) * 10,
      reward: { type: "GOLD", amount: 100 },
      claimed: claimed[i],
      reached: reached[i],
    }),
  ),
});

describe("helpers de paliers", () => {
  it("le prochain palier est le premier non réclamé", () => {
    expect(nextAchievementTier(progress([true, false, false], [true, true, false]))?.tier).toBe(
      AchievementTier.SILVER,
    );
    expect(nextAchievementTier(progress([true, true, true], [true, true, true]))).toBeNull();
  });

  it("réclamable seulement si le prochain palier est atteint", () => {
    expect(isAchievementClaimable(progress([true, false, false], [true, true, false]))).toBe(true);
    expect(isAchievementClaimable(progress([true, false, false], [true, false, false]))).toBe(false);
  });
});

describe("rarityAtLeast", () => {
  it("compare selon l'ordre common < … < secret", () => {
    expect(rarityAtLeast(Rarity.EPIC, Rarity.RARE)).toBe(true);
    expect(rarityAtLeast(Rarity.RARE, Rarity.RARE)).toBe(true);
    expect(rarityAtLeast(Rarity.UNCOMMON, Rarity.RARE)).toBe(false);
  });
});
