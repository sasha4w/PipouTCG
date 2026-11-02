import type { CSSProperties, ReactNode } from "react";

/** Contour de l'illustration qui se remplit avec la charge, « n/max » en dessous. */
export function ChargeFrame({ counters, max, fx, children }: { counters: number; max: number; fx?: "pulse" | "burst"; children: ReactNode }) {
  const pct = Math.min(100, Math.round((counters / Math.max(1, max)) * 100));
  return (
    <div className={`zr-charge${fx ? ` zr-charge--${fx}` : ""}`}>
      <div
        className="zr-charge__frame"
        style={{ "--charge": `${pct}%` } as CSSProperties}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={counters}
      >
        {children}
      </div>
      <span className="zr-charge__count">{counters}/{max}</span>
    </div>
  );
}
