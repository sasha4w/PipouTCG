import { SupportType, type CardInstance } from "@pipou/shared";
import type { ZoneFxMap } from "./fightEvents";

/** Terrain affiché en fond : le dernier posé encore en jeu. */
export function pickActiveTerrain(
  zones: readonly (CardInstance | null)[],
): CardInstance | null {
  let best: CardInstance | null = null;
  for (const zone of zones) {
    if (zone?.baseCard.supportType !== SupportType.TERRAIN) continue;
    if (!best || (zone.placedSeq ?? -1) > (best.placedSeq ?? -1)) best = zone;
  }
  return best;
}

/** Zone d'où part la vague : celle du terrain actif s'il vient d'être posé. */
export function terrainWaveZone(
  terrain: CardInstance | null,
  zones: readonly (CardInstance | null)[],
  fx: ZoneFxMap,
): number | null {
  if (!terrain) return null;
  const idx = zones.findIndex((z) => z?.instanceId === terrain.instanceId);
  return idx !== -1 && fx.get(idx)?.terrainPlayed ? idx : null;
}
