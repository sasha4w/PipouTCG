import { useEffect, useRef, useState } from "react";
import { isMonsterZone, type BoardZone } from "../fight.types";

const modeOf = (zone: BoardZone | null) =>
  zone && isMonsterZone(zone) ? zone.mode : undefined;

export function useZoneAnimations(
  zones: (BoardZone | null)[],
  isSupport: boolean,
) {
  const prevZonesRef = useRef<(BoardZone | null)[]>(zones.map(() => null));
  const prevModesRef = useRef<(string | undefined)[]>(zones.map(modeOf));

  const [summoningZones, setSummoningZones] = useState<Set<number>>(new Set());
  const [flippingZones, setFlippingZones] = useState<Set<number>>(new Set());
  const [dyingZones, setDyingZones] = useState<Map<number, BoardZone>>(
    new Map(),
  );

  useEffect(() => {
    const prevZones = prevZonesRef.current;
    const prevModes = prevModesRef.current;

    const newSummoning = new Set<number>();
    const newFlipping = new Set<number>();

    zones.forEach((zone, idx) => {
      if (!prevZones[idx] && zone) newSummoning.add(idx);

      if (prevZones[idx] && !zone) {
        const snapshot = prevZones[idx];
        setDyingZones((prev) => new Map([...prev, [idx, snapshot]]));
        setTimeout(() => {
          setDyingZones((prev) => {
            const next = new Map(prev);
            next.delete(idx);
            return next;
          });
        }, 900);
      }

      if (!isSupport && prevZones[idx] && zone) {
        const prevMode = prevModes[idx];
        const curMode = modeOf(zone);
        if (prevMode && curMode && prevMode !== curMode) newFlipping.add(idx);
      }
    });

    if (newSummoning.size > 0) {
      setSummoningZones(newSummoning);
      setTimeout(() => setSummoningZones(new Set()), 500);
    }
    if (newFlipping.size > 0) {
      setFlippingZones(newFlipping);
      setTimeout(() => setFlippingZones(new Set()), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  useEffect(() => {
    prevZonesRef.current = [...zones];
    prevModesRef.current = zones.map(modeOf);
  });

  return { summoningZones, flippingZones, dyingZones };
}
