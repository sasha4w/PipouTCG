import { describe, expect, it } from "vitest";
import {
  chargesOnEquipment,
  graveyardCountRequirement,
  meetsGraveyardCount,
  summonOnlyByEffect,
} from "./summon-conditions";
import { canSummonFromHand, isSpecialSummon } from "./rules";

const MAGOUILLE = [
  {
    trigger: "PASSIVE",
    condition: null,
    actions: [
      {
        type: "SUMMON_IF_GRAVEYARD_COUNT",
        target: "SELF",
        value: 4,
        filter: { archetype: "pipou", type: "monster", rarities: ["epic", "legendary"] },
      },
    ],
  },
] as never;
const DELTA = [
  { trigger: "PASSIVE", condition: null, actions: [{ type: "SUMMON_ONLY_BY_EFFECT", target: "SELF" }] },
] as never;
const card = (rarity: string, archetype = "pipou", type = "monster") =>
  ({ rarity, archetype, type, name: "x" }) as never;

describe("graveyardCountRequirement", () => {
  it("lit valeur et filtre", () => {
    expect(graveyardCountRequirement(MAGOUILLE)).toEqual({
      value: 4,
      filter: { archetype: "pipou", type: "monster", rarities: ["epic", "legendary"] },
    });
  });
  it("null sans la condition", () => {
    expect(graveyardCountRequirement(DELTA)).toBeNull();
  });
});

describe("meetsGraveyardCount", () => {
  it("faux avec 3 épiques/légendaires pipou", () => {
    expect(meetsGraveyardCount(MAGOUILLE, [card("epic"), card("legendary"), card("epic"), card("rare")])).toBe(false);
  });
  it("vrai avec 4, les autres archétypes et les supports ne comptent pas", () => {
    expect(
      meetsGraveyardCount(MAGOUILLE, [
        card("epic"), card("epic"), card("legendary"), card("legendary"),
        card("epic", "pixelman"), card("epic", "pipou", "support"),
      ]),
    ).toBe(true);
  });
  it("vrai sans condition", () => {
    expect(meetsGraveyardCount(DELTA, [])).toBe(true);
  });
});

describe("conditions d'invocation", () => {
  it("Delta n'est jamais invocable depuis la main", () => {
    expect(summonOnlyByEffect(DELTA)).toBe(true);
    expect(canSummonFromHand({ stage: null, effects: DELTA })).toBe(false);
  });
  it("Magouille est une invocation spéciale (autorisée en phase de contrôle)", () => {
    expect(canSummonFromHand({ stage: null, effects: MAGOUILLE })).toBe(true);
    expect(isSpecialSummon({ effects: MAGOUILLE })).toBe(true);
  });
  it("chargesOnEquipment", () => {
    const fx = [{ trigger: "PASSIVE", condition: null, actions: [{ type: "CHARGE_ON_EQUIPMENT", target: "SELF" }] }] as never;
    expect(chargesOnEquipment(fx)).toBe(true);
    expect(chargesOnEquipment(DELTA)).toBe(false);
  });
});
