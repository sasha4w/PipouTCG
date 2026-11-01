import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import InspectableCard from "./InspectableCard";
import CardDrawer from "./CardDrawer";
import "./GraveyardPile.css";
import type { CardInstance } from "./fight.types";

interface Props {
  graveyard: CardInstance[];
  label: string;
}

export default function GraveyardPile({ graveyard, label }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inspected, setInspected] = useState<CardInstance | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  if (graveyard.length === 0) return null;

  return (
    <>
      <button
        className="gp-pile"
        onClick={() => setOpen(true)}
        title={t("fight.graveyard.title", { count: graveyard.length })}
      >
        <span className="gp-icon">🪦</span>
        <span className="gp-count">{graveyard.length}</span>
      </button>

      {/* Hors du plateau : un ancêtre empilé y placerait la main et le HUD par-dessus */}
      {open &&
        createPortal(
          <div className="gp-overlay" onClick={() => setOpen(false)}>
            <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="gp-modal-header">
                <span>
                  {t("fight.graveyard.owner", {
                    name: label,
                    count: graveyard.length,
                  })}
                </span>
                <button
                  className="gp-close"
                  aria-label={t("fight.graveyard.close")}
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="gp-list">
                {[...graveyard].reverse().map((c) => (
                  <InspectableCard
                    key={c.instanceId}
                    card={c.baseCard}
                    size="sm"
                    selected={pickedId === c.instanceId}
                    onClick={() => setPickedId(c.instanceId)}
                    onInfo={() => setInspected(c)}
                  />
                ))}
              </div>
              {inspected && (
                <CardDrawer
                  card={inspected.baseCard}
                  onClose={() => setInspected(null)}
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
