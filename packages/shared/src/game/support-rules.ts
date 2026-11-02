import { EQUIP_SLOT_CAPACITY, EquipmentSlot, SupportType } from "../enums/card";

interface SupportCardLike {
  name: string;
  supportType: SupportType | null;
  equipmentSlot: EquipmentSlot | null;
  isTerrain: boolean;
}
interface InstanceLike {
  instanceId: string;
  baseCard: SupportCardLike;
}

export type EquipCheck =
  | { kind: "ok" }
  | { kind: "no_slot" }
  | { kind: "duplicate" }
  | { kind: "slot_full"; replaceable: string[] };

/** L'équipement `card` peut-il aller sur un monstre qui porte déjà `equipments` ? */
export function canEquip(
  equipments: readonly InstanceLike[],
  card: SupportCardLike,
): EquipCheck {
  const slot = card.equipmentSlot;
  if (!slot) return { kind: "no_slot" };
  const sameSlot = equipments.filter((e) => e.baseCard.equipmentSlot === slot);
  if (
    slot === EquipmentSlot.ACCESSORY &&
    sameSlot.some((e) => e.baseCard.name === card.name)
  )
    return { kind: "duplicate" };
  if (sameSlot.length < EQUIP_SLOT_CAPACITY[slot]) return { kind: "ok" };
  return { kind: "slot_full", replaceable: sameSlot.map((e) => e.instanceId) };
}

/** Case du Terrain que `card` remplacerait, ou null. */
export function terrainToReplace(
  supportZones: readonly (InstanceLike | null)[],
  card: SupportCardLike,
): number | null {
  if (!card.isTerrain) return null;
  const idx = supportZones.findIndex((z) => !!z?.baseCard.isTerrain);
  return idx === -1 ? null : idx;
}

export type SupportPlacement =
  | { kind: "ok" }
  | { kind: "duplicate" }
  | { kind: "full" }
  | { kind: "replace_terrain"; zoneIndex: number };

/** Un Persistant ou une Charge peut-il être posé ? */
export function canPlaceInSupportZone(
  supportZones: readonly (InstanceLike | null)[],
  card: SupportCardLike,
): SupportPlacement {
  if (supportZones.some((z) => z?.baseCard.name === card.name))
    return { kind: "duplicate" };
  const terrainIdx = terrainToReplace(supportZones, card);
  if (terrainIdx !== null) return { kind: "replace_terrain", zoneIndex: terrainIdx };
  if (supportZones.every((z) => z !== null)) return { kind: "full" };
  return { kind: "ok" };
}
