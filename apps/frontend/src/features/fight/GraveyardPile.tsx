import { useState } from "react";
import InspectableCard from "./InspectableCard";
import CardInspect from "./CardInspect";
import "./GraveyardPile.css";
import type { CardInstance } from "./fight.types";

interface Props {
  graveyard: CardInstance[];
  label: string;
}

export default function GraveyardPile({ graveyard, label }: Props) {
  const [open, setOpen] = useState(false);
  const [inspected, setInspected] = useState<CardInstance | null>(null);

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
              {[...graveyard].reverse().map((c) => (
                <InspectableCard
                  key={c.instanceId}
                  card={c.baseCard}
                  size="sm"
                  onInspect={() => setInspected(c)}
                  onInspectEnd={() => setInspected(null)}
                />
              ))}
            </div>
            {inspected && (
              <CardInspect
                card={inspected.baseCard}
                onClose={() => setInspected(null)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
