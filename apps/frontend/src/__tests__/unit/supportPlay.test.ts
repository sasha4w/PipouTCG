import { describe, expect, it } from "vitest";
import { equipIntent, zoneIntent } from "../../features/fight/supportPlay";

const inst = (name: string, extra: object = {}) =>
  ({ instanceId: name, baseCard: { name, supportType: "EQUIPMENT", equipmentSlot: "OFFENSIVE", isTerrain: false, ...extra } }) as { instanceId: string; baseCard: never };

describe("equipIntent", () => {
  it("joue directement si l'emplacement est libre", () => {
    expect(equipIntent({ equipments: [] } as never, inst("Canon").baseCard)).toEqual({ kind: "play" });
  });
  it("demande confirmation si plein", () => {
    expect(equipIntent({ equipments: [inst("Proc")] } as never, inst("Canon").baseCard)).toEqual({
      kind: "confirm", replaceable: ["Proc"],
    });
  });
  it("bloque un doublon d'accessoire", () => {
    const m = inst("Module", { equipmentSlot: "ACCESSORY" });
    expect(equipIntent({ equipments: [m] } as never, m.baseCard)).toEqual({ kind: "blocked" });
  });
});

describe("zoneIntent", () => {
  it("demande confirmation pour remplacer un Terrain", () => {
    const old = inst("Mont", { supportType: "PERSISTENT", isTerrain: true });
    const card = inst("Tactique", { supportType: "PERSISTENT", isTerrain: true }).baseCard;
    expect(zoneIntent([null, old, null] as never, card)).toEqual({ kind: "confirm_terrain", zoneIndex: 1, old: "Mont" });
  });
  it("bloque si les 3 cases sont pleines", () => {
    const p = (n: string) => inst(n, { supportType: "PERSISTENT" });
    expect(zoneIntent([p("A"), p("B"), p("C")] as never, p("D").baseCard)).toEqual({ kind: "blocked", reason: "full" });
  });
});
