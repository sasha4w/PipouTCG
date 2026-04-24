import { useState } from "react";
import "./GraveyardPile.css";
import type { CardInstance } from "./fight.types";

interface Props {
  graveyard: CardInstance[];
  label: string;
}

export default function GraveyardPile({ graveyard, label }: Props) {
  const [open, setOpen] = useState(false);

  if (graveyard.length === 0) return null;

  return (
    <>
      <button
        className="gp-pile"
        onClick={() => setOpen(true)}
        title={`Cimetière (${graveyard.length})`}
      >
        <span className="gp-icon">🪦</span>
        <span className="gp-count">{graveyard.length}</span>
      </button>

      {open && (
        <div className="gp-overlay" onClick={() => setOpen(false)}>
          <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gp-modal-header">
              <span>
                {label} — Cimetière ({graveyard.length})
              </span>
              <button className="gp-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="gp-list">
              {[...graveyard].reverse().map((c, i) => (
                <div key={i} className="gp-card">
                  <span className="gp-card-name">{c.baseCard.name}</span>
                  <span className="gp-card-type">{c.baseCard.type}</span>
                  {c.baseCard.type === "monster" && (
                    <span className="gp-card-stats">
                      {c.baseCard.atk}⚔ {c.baseCard.hp}❤
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
