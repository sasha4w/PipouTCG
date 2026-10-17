import { describe, expect, it } from "vitest";
import type { CardInstance } from "@pipou/shared";
import {
  pickActiveTerrain,
  terrainWaveZone,
} from "../../features/fight/terrainSelection";

const terrain = (instanceId: string, placedSeq?: number): CardInstance => ({
  instanceId,
  ownerId: 1,
  placedSeq,
  baseCard: {
    id: 1,
    name: instanceId,
    rarity: "rare",
    type: "support",
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: "TERRAIN",
    archetype: null,
    element: null,
    lineage: null,
    stage: null,
    effects: null,
    description: null,
    image: null,
  },
});

describe("pickActiveTerrain", () => {
  it("prend le dernier terrain posé", () => {
    expect(
      pickActiveTerrain([terrain("a", 3), null, terrain("b", 5)])?.instanceId,
    ).toBe("b");
  });

  it("revient au précédent quand le dernier part", () => {
    expect(pickActiveTerrain([terrain("a", 3), null, null])?.instanceId).toBe("a");
  });

  it("un terrain sans numéro passe après les autres", () => {
    expect(
      pickActiveTerrain([terrain("x"), terrain("a", 1), null])?.instanceId,
    ).toBe("a");
  });

  it("aucun terrain : null", () => {
    expect(pickActiveTerrain([null, null, null])).toBeNull();
  });
});

describe("terrainWaveZone", () => {
  it("zone du terrain actif quand il vient d'être posé", () => {
    const zones = [null, terrain("a", 1), null];
    expect(
      terrainWaveZone(zones[1], zones, new Map([[1, { terrainPlayed: true }]])),
    ).toBe(1);
  });

  it("null sans pose dans l'action", () => {
    const zones = [null, terrain("a", 1), null];
    expect(terrainWaveZone(zones[1], zones, new Map())).toBeNull();
  });
});
