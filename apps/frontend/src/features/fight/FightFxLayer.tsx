import type React from "react";
import "./FightFxLayer.css";

interface Props {
  /** Nouveau `key` à chaque flash : l'animation CSS rejoue au montage. */
  flash: { key: number; color: string } | null;
}

/** Effets plein plateau, au-dessus des zones et sans capter les clics. */
export default function FightFxLayer({ flash }: Props) {
  return (
    <div className="ffx-layer" aria-hidden>
      {flash && (
        <div
          key={flash.key}
          className="ffx-flash"
          style={{ "--ffx-color": flash.color } as React.CSSProperties}
        />
      )}
    </div>
  );
}
