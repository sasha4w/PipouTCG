import { describe, expect, it } from "vitest";
import type { OpenedCard } from "../../services/opening.service";
import {
  bestRarity,
  buildReveal,
  rarityRank,
  sortForParade,
  sortForSummary,
} from "./openingPlan";

let seq = 0;
const mk = (rarity: string, isNew = false): OpenedCard => ({
  id: ++seq,
  name: `c${seq}`,
  rarity,
  type: "monster",
  supportType: null,
  atk: 0,
  hp: 0,
  cost: 0,
  description: null,
  image: null,
  isNew,
});

const common = mk("common");
const rare = mk("rare");
const epicA = mk("epic");
const epicB = mk("epic");
const legendary = mk("legendary");
const secret = mk("secret");

describe("rarity helpers", () => {
  it("ranks and picks best", () => {
    expect(rarityRank("common")).toBe(0);
    expect(rarityRank("secret")).toBe(5);
    expect(bestRarity([common, epicA, rare])).toBe("epic");
  });
  it("sorts parade ascending and summary descending, new first on tie", () => {
    expect(sortForParade([epicA, common, rare]).map((c) => c.rarity)).toEqual([
      "common",
      "rare",
      "epic",
    ]);
    const oldRare = mk("rare");
    const newRare = mk("rare", true);
    expect(sortForSummary([common, oldRare, newRare, epicA])).toEqual([
      epicA,
      newRare,
      oldRare,
      common,
    ]);
  });
});

describe("buildReveal", () => {
  it("simple mode: every card waits for a click", () => {
    expect(buildReveal([common], false)[0]).toMatchObject({
      ritual: "none",
      holdForClick: true,
      autoAdvanceMs: null,
    });
    expect(buildReveal([epicA], false)[0]).toMatchObject({ ritual: "full", blackoutMs: 400 });
    expect(buildReveal([legendary], false)[0].blackoutMs).toBe(600);
    expect(buildReveal([secret], false)[0].blackoutMs).toBe(900);
  });
  it("mega mode rhythm", () => {
    const m = buildReveal([common, rare, epicA, epicB], true);
    expect(m[0]).toMatchObject({ holdForClick: false, autoAdvanceMs: 110 });
    expect(m[1]).toMatchObject({ holdForClick: false, autoAdvanceMs: 480 });
    expect(m[2]).toMatchObject({ ritual: "short", blackoutMs: 0, holdForClick: true });
    expect(m[3]).toMatchObject({ ritual: "full", blackoutMs: 400 });
    expect(buildReveal([epicA, legendary], true)[0].ritual).toBe("short");
  });
  it("mega mode new cards", () => {
    expect(buildReveal([{ ...common, isNew: true }], true)[0]).toMatchObject({
      holdForClick: false,
      autoAdvanceMs: 400,
    });
    expect(buildReveal([{ ...rare, isNew: true }], true)[0].holdForClick).toBe(true);
  });
});
