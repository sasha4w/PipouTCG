import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { CardInstance } from "@pipou/shared";
import { RARITY_COLOR } from "./fight.types";
import "./TerrainBackground.css";

/** Durée pendant laquelle l'ancien fond reste sous le nouveau. */
const TRANSITION_MS = 700;

type Side = "me" | "opponent";

interface Props {
  terrain: CardInstance | null;
  side: Side;
  /** Zone Support du terrain qui vient d'être posé (vague), sinon null (fondu). */
  waveFromZone: number | null;
  reduced: boolean;
}

/** Origine approximative de la vague : la zone Support dans la rangée du joueur. */
function waveOrigin(side: Side, zone: number): React.CSSProperties {
  const x = side === "me" ? 15 + zone * 30 : 25 + zone * 30;
  const y = side === "me" ? 82 : 18;
  return { "--wave-x": `${x}%`, "--wave-y": `${y}%` } as React.CSSProperties;
}

function layerStyle(terrain: CardInstance): React.CSSProperties {
  const url = terrain.baseCard.image?.url;
  if (url) return { backgroundImage: `url("${url}")` };
  const color = RARITY_COLOR[terrain.baseCard.rarity] ?? "#a8a8a8";
  return { backgroundImage: `linear-gradient(135deg, ${color}, transparent)` };
}

interface LayerProps {
  terrain: CardInstance;
  side: Side;
  waveFromZone: number | null;
}

/** Calque entrant : le mode d'entrée est figé au montage (un par terrain). */
function EnteringLayer({ terrain, side, waveFromZone }: LayerProps) {
  const [wave] = useState(waveFromZone);
  return (
    <div
      className={`tbg__layer ${wave !== null ? "tbg__layer--wave" : "tbg__layer--fade"}`}
      style={{
        ...layerStyle(terrain),
        ...(wave !== null ? waveOrigin(side, wave) : {}),
      }}
    />
  );
}

export default function TerrainBackground({
  terrain,
  side,
  waveFromZone,
  reduced,
}: Props) {
  const id = terrain?.instanceId ?? null;
  const lastRef = useRef<CardInstance | null>(terrain);
  const [leaving, setLeaving] = useState<CardInstance | null>(null);

  useEffect(() => {
    const last = lastRef.current;
    lastRef.current = terrain;
    if ((last?.instanceId ?? null) === id) return;
    setLeaving(last);
    const t = setTimeout(() => setLeaving(null), TRANSITION_MS);
    return () => clearTimeout(t);
    // Seul un changement de terrain (id) déclenche la transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div
      className={`tbg tbg--${side}${reduced ? " tbg--reduced" : ""}`}
      aria-hidden
    >
      {leaving && (
        <div
          key={`out-${leaving.instanceId}`}
          className="tbg__layer tbg__layer--out"
          style={layerStyle(leaving)}
        />
      )}
      {terrain && (
        <EnteringLayer
          key={terrain.instanceId}
          terrain={terrain}
          side={side}
          waveFromZone={waveFromZone}
        />
      )}
    </div>
  );
}
