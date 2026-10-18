import { describe, it, expect } from "vitest";
import { ADVENTURE_LEVEL_DEFAULTS } from "./adventure";

const levels = [1, 2, 3, 4, 5] as const;

describe("ADVENTURE_LEVEL_DEFAULTS", () => {
  it("valeurs clés", () => {
    expect(ADVENTURE_LEVEL_DEFAULTS[5].farmLegendaryPct).toBe(2);
    expect(ADVENTURE_LEVEL_DEFAULTS[1].firstWinGold).toBe(100);
  });
  it("or/XP croissants du niveau 1 au 5", () => {
    for (let i = 1; i < levels.length; i++) {
      const a = ADVENTURE_LEVEL_DEFAULTS[levels[i - 1]];
      const b = ADVENTURE_LEVEL_DEFAULTS[levels[i]];
      for (const k of ["firstWinGold", "firstWinXp", "farmGold", "farmXp"] as const) {
        expect(b[k]).toBeGreaterThan(a[k]);
      }
    }
  });
  it("pas de légendaire hors boss", () => {
    for (const l of [1, 2, 3, 4] as const) expect(ADVENTURE_LEVEL_DEFAULTS[l].farmLegendaryPct).toBe(0);
  });
});
