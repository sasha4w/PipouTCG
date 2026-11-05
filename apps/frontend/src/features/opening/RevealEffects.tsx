import type { CSSProperties } from "react";
import { rarityRank, type RevealStep } from "./openingPlan";

const MOTE_COUNT: Record<string, number> = { epic: 14, legendary: 56, secret: 126 };

interface RevealEffectsProps {
  rarity: string;
  ritual: RevealStep["ritual"];
  reduced: boolean;
}

/** Couche d'effets décorative : halo, flash, anneaux, rayons, éclats. */
export function RevealEffects({ rarity, ritual, reduced }: RevealEffectsProps) {
  const rank = rarityRank(rarity);
  const rare = rank >= rarityRank("rare");
  const epic = rank >= rarityRank("epic");
  const legendary = rank >= rarityRank("legendary");
  const moteCount = epic && ritual !== "short" ? (MOTE_COUNT[rarity] ?? 0) : 0;

  return (
    <div className="opening-fx__layer" aria-hidden="true">
      {rank >= 1 && <div className="opening-fx__halo" />}
      {rare && !reduced && <div className="opening-fx__flash" />}
      {rare && <div className="opening-fx__ring" />}
      {epic && <div className="opening-fx__ring opening-fx__ring--late" />}
      {legendary && !reduced && <div className="opening-fx__rays" />}
      {!reduced &&
        Array.from({ length: moteCount }, (_, i) => (
          <span
            key={i}
            className="opening-fx__mote"
            style={
              {
                "--a": `${(i * 137.5) % 360}deg`,
                "--d": `${90 + ((i * 53) % 170)}px`,
                "--delay": `${(i % 12) * 40}ms`,
                "--hue": `${(i * 47) % 360}`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
