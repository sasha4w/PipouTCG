import type { CSSProperties, ReactNode } from "react";
import type { ChargeFx } from "../fightEvents";
import { IconTarget } from "../../../components/Icons";

interface Props {
  counters: number;
  max: number;
  fx?: ChargeFx;
  /** La carte reste en jeu : l'animation ne la fait pas disparaître. */
  live?: boolean;
  /** Condition d'activation non remplie, affichée sous le décompte. */
  warning?: string;
  children: ReactNode;
}

/** Contour de l'illustration qui se remplit avec la charge, « n/max » en dessous. */
export function ChargeFrame({ counters, max, fx, live, warning, children }: Props) {
  const pct = Math.min(100, Math.round((counters / Math.max(1, max)) * 100));
  const classes = [
    "zr-charge",
    fx ? `zr-charge--${fx}${live && fx !== "pulse" ? "-live" : ""}` : "",
    // Pleine et en attente d'un choix : elle luit
    counters >= max ? "zr-charge--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <div
        className="zr-charge__frame"
        style={{ "--charge": `${pct}%` } as CSSProperties}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={counters}
      >
        {children}
        {fx === "fizzle" && <span className="zr-charge__smoke" aria-hidden />}
      </div>
      <span className="zr-charge__count">
        {counters}/{max}
        {warning && (
          <span className="zr-charge__warn" role="status">
            <IconTarget size={10} /> {warning}
          </span>
        )}
      </span>
    </div>
  );
}
