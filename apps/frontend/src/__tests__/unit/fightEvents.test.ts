import { describe, expect, it } from "vitest";
import type { FightEvent } from "@pipou/shared";
import { boardFxFromEvents, summonTier } from "../../features/fight/fightEvents";

const ME = 1;
const OPP = 2;

describe("summonTier", () => {
  it.each([
    ["common", 1],
    ["uncommon", 1],
    ["rare", 2],
    ["epic", 2],
    ["legendary", 3],
    ["secret", 4],
  ] as const)("%s → palier %i", (rarity, tier) => {
    expect(summonTier(rarity)).toBe(tier);
  });
});

describe("boardFxFromEvents", () => {
  it("range chaque événement par côté et par zone", () => {
    const events: FightEvent[] = [
      { kind: "monster_summoned", ownerId: ME, zoneIndex: 1, instanceId: "a", rarity: "epic" },
      { kind: "monster_destroyed", ownerId: OPP, zoneIndex: 0, instanceId: "b", cause: "sacrifice" },
      { kind: "terrain_played", ownerId: OPP, zoneIndex: 2, instanceId: "t" },
    ];

    const fx = boardFxFromEvents(events, ME);

    expect(fx.me.monsters.get(1)).toEqual({ summonTier: 2 });
    expect(fx.opponent.monsters.get(0)).toEqual({ destroyCause: "sacrifice" });
    expect(fx.opponent.supports.get(2)).toEqual({ terrainPlayed: true });
    expect(fx.me.supports.size).toBe(0);
  });

  it("fusionne destruction et invocation sur la même zone", () => {
    const fx = boardFxFromEvents(
      [
        { kind: "monster_destroyed", ownerId: ME, zoneIndex: 0, instanceId: "a", cause: "combat" },
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 0, instanceId: "b", rarity: "rare" },
      ],
      ME,
    );
    expect(fx.me.monsters.get(0)).toEqual({ destroyCause: "combat", summonTier: 2 });
  });

  it("retient l'invocation la plus forte de l'action", () => {
    const fx = boardFxFromEvents(
      [
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 0, instanceId: "a", rarity: "legendary" },
        { kind: "monster_summoned", ownerId: OPP, zoneIndex: 0, instanceId: "b", rarity: "secret" },
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 1, instanceId: "c", rarity: "common" },
      ],
      ME,
    );
    expect(fx.topSummon).toEqual({ tier: 4, rarity: "secret" });
  });

  it("aucun événement : cartes vides, pas d'invocation", () => {
    const fx = boardFxFromEvents([], ME);
    expect(fx.me.monsters.size).toBe(0);
    expect(fx.topSummon).toBeNull();
  });
});
