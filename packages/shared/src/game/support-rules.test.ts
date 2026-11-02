import { describe, expect, it } from "vitest";
import { EquipmentSlot, SupportType } from "../enums/card";
import { canEquip, canPlaceInSupportZone, terrainToReplace } from "./support-rules";

type C = { name: string; supportType: SupportType | null; equipmentSlot: EquipmentSlot | null; isTerrain: boolean };
const eq = (name: string, equipmentSlot: EquipmentSlot): C => ({
  name, supportType: SupportType.EQUIPMENT, equipmentSlot, isTerrain: false,
});
const inst = (c: C, id = c.name) => ({ instanceId: id, baseCard: c });
const persistent = (name: string, isTerrain = false): C => ({
  name, supportType: SupportType.PERSISTENT, equipmentSlot: null, isTerrain,
});

describe("canEquip", () => {
  const canon = eq("Canon", EquipmentSlot.OFFENSIVE);
  const proc = eq("Processeur", EquipmentSlot.OFFENSIVE);
  const repa = eq("Réparation", EquipmentSlot.ACCESSORY);
  const autre = eq("Autre", EquipmentSlot.ACCESSORY);

  it("emplacement libre", () => {
    expect(canEquip([], canon)).toEqual({ kind: "ok" });
  });
  it("offensif plein : propose de remplacer l'occupant", () => {
    expect(canEquip([inst(proc, "p1")], canon)).toEqual({
      kind: "slot_full", replaceable: ["p1"],
    });
  });
  it("deux accessoires différents tiennent", () => {
    expect(canEquip([inst(autre)], repa)).toEqual({ kind: "ok" });
  });
  it("accessoire en double refusé", () => {
    expect(canEquip([inst(repa)], repa)).toEqual({ kind: "duplicate" });
  });
  it("accessoires pleins : les deux sont remplaçables", () => {
    const third = eq("Troisième", EquipmentSlot.ACCESSORY);
    expect(canEquip([inst(repa, "a"), inst(autre, "b")], third)).toEqual({
      kind: "slot_full", replaceable: ["a", "b"],
    });
  });
  it("équipement sans emplacement : refusé", () => {
    expect(canEquip([], { ...canon, equipmentSlot: null })).toEqual({ kind: "no_slot" });
  });
});

describe("terrainToReplace", () => {
  it("renvoie la case du Terrain en place", () => {
    const zones = [null, inst(persistent("Mont Drakon", true)), null];
    expect(terrainToReplace(zones, persistent("Tactique", true))).toBe(1);
  });
  it("null si la carte n'est pas un Terrain", () => {
    const zones = [inst(persistent("Mont Drakon", true)), null, null];
    expect(terrainToReplace(zones, persistent("Bannière"))).toBeNull();
  });
  it("null si aucun Terrain n'est posé", () => {
    expect(terrainToReplace([null, null, null], persistent("Tactique", true))).toBeNull();
  });
});

describe("canPlaceInSupportZone", () => {
  it("doublon refusé", () => {
    const b = persistent("Bannière");
    expect(canPlaceInSupportZone([inst(b), null, null], b)).toEqual({ kind: "duplicate" });
  });
  it("zones pleines refusé", () => {
    const zones = [inst(persistent("A")), inst(persistent("B")), inst(persistent("C"))];
    expect(canPlaceInSupportZone(zones, persistent("D"))).toEqual({ kind: "full" });
  });
  it("zones pleines mais Terrain à remplacer : ok", () => {
    const zones = [inst(persistent("Mont", true)), inst(persistent("B")), inst(persistent("C"))];
    expect(canPlaceInSupportZone(zones, persistent("Tactique", true))).toEqual({
      kind: "replace_terrain", zoneIndex: 0,
    });
  });
  it("case libre", () => {
    expect(canPlaceInSupportZone([null, null, null], persistent("A"))).toEqual({ kind: "ok" });
  });
});
