import { canEquip, canPlaceInSupportZone } from "@pipou/shared";
import type { CardInstance, ClientCard, MonsterOnBoard } from "@pipou/shared";

export type EquipIntent =
  | { kind: "play" }
  | { kind: "confirm"; replaceable: string[] }
  | { kind: "blocked" };

/** Que se passe-t-il si on équipe `card` sur ce monstre ? */
export function equipIntent(
  monster: Pick<MonsterOnBoard, "equipments">,
  card: ClientCard,
): EquipIntent {
  const check = canEquip(monster.equipments, card);
  if (check.kind === "ok") return { kind: "play" };
  if (check.kind === "slot_full")
    return { kind: "confirm", replaceable: check.replaceable };
  return { kind: "blocked" };
}

export type ZoneIntent =
  | { kind: "play" }
  | { kind: "confirm_terrain"; zoneIndex: number; old: string }
  | { kind: "blocked"; reason: "full" | "duplicate" };

/** Que se passe-t-il si on pose `card` (Persistant, Charge, Terrain) en zone support ? */
export function zoneIntent(
  supportZones: readonly (CardInstance | null)[],
  card: ClientCard,
): ZoneIntent {
  const p = canPlaceInSupportZone(supportZones, card);
  if (p.kind === "ok") return { kind: "play" };
  if (p.kind === "replace_terrain")
    return {
      kind: "confirm_terrain",
      zoneIndex: p.zoneIndex,
      old: supportZones[p.zoneIndex]!.instanceId,
    };
  return { kind: "blocked", reason: p.kind };
}
