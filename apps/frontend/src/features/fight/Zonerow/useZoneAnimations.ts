import { useEffect, useRef, useState } from "react";
import type { DestroyCause } from "@pipou/shared";
import { isMonsterZone, type BoardZone } from "../fight.types";
import {
  DESTROY_MS,
  EMPTY_ZONE_FX,
  REDUCED_MS,
  SUMMON_MS,
  summonTier,
  type SummonTier,
  type ZoneFxMap,
} from "../fightEvents";

const modeOf = (zone: BoardZone | null) =>
  zone && isMonsterZone(zone) ? zone.mode : undefined;

export interface DyingZone {
  zone: BoardZone;
  cause: DestroyCause;
}

function without<V>(map: ReadonlyMap<number, V>, key: number) {
  const next = new Map(map);
  next.delete(key);
  return next;
}

/**
 * Animations par zone, déduites de la comparaison avec l'état précédent.
 * `fx` (événements serveur) précise le palier d'invocation et la cause de
 * destruction ; sans événement : palier de la rareté, destruction « combat ».
 */
export function useZoneAnimations(
  zones: (BoardZone | null)[],
  isSupport: boolean,
  fx: ZoneFxMap = EMPTY_ZONE_FX,
  reduced = false,
) {
  const prevZonesRef = useRef<(BoardZone | null)[]>(zones.map(() => null));
  const prevModesRef = useRef<(string | undefined)[]>(zones.map(modeOf));
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [summoningZones, setSummoningZones] = useState<
    ReadonlyMap<number, SummonTier>
  >(new Map());
  const [flippingZones, setFlippingZones] = useState<Set<number>>(new Set());
  const [dyingZones, setDyingZones] = useState<ReadonlyMap<number, DyingZone>>(
    new Map(),
  );

  useEffect(() => {
    const prevZones = prevZonesRef.current;
    const prevModes = prevModesRef.current;
    const later = (ms: number, fn: () => void) =>
      timersRef.current.push(setTimeout(fn, ms));

    const newFlipping = new Set<number>();

    zones.forEach((zone, idx) => {
      const prev = prevZones[idx];

      // Zone remplie, ou monstre remplacé sur place (évolution) : invocation
      if (zone && (!prev || prev.instanceId !== zone.instanceId)) {
        const tier: SummonTier = isSupport
          ? 1
          : (fx.get(idx)?.summonTier ??
            (isMonsterZone(zone) ? summonTier(zone.card.baseCard.rarity) : 1));
        setSummoningZones((m) => new Map(m).set(idx, tier));
        later(reduced ? REDUCED_MS : SUMMON_MS[tier], () =>
          setSummoningZones((m) => without(m, idx)),
        );
      }

      if (prev && !zone) {
        const cause = fx.get(idx)?.destroyCause ?? "combat";
        setDyingZones((m) => new Map(m).set(idx, { zone: prev, cause }));
        later(reduced ? REDUCED_MS : DESTROY_MS[cause], () =>
          setDyingZones((m) => without(m, idx)),
        );
      }

      if (!isSupport && prev && zone) {
        const prevMode = prevModes[idx];
        const curMode = modeOf(zone);
        if (prevMode && curMode && prevMode !== curMode) newFlipping.add(idx);
      }
    });

    if (newFlipping.size > 0) {
      setFlippingZones(newFlipping);
      later(450, () => setFlippingZones(new Set()));
    }
    // fx et reduced accompagnent le même état que zones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  useEffect(() => {
    prevZonesRef.current = [...zones];
    prevModesRef.current = zones.map(modeOf);
  });

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  return { summoningZones, flippingZones, dyingZones };
}
