import { useState } from "react";
import type { PendingChoice, ClientChoiceCandidate } from "./fight.types";
import { RARITY_COLOR } from "./fight.types";
import "./CardPickModal.css";

interface Props {
  choice: PendingChoice;
  onConfirm: (instanceIds: string[]) => void;
}

export default function CardPickModal({ choice, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (instanceId: string) => {
    setSelected((prev) => {
      if (prev.includes(instanceId)) {
        return prev.filter((id) => id !== instanceId);
      }
      if (prev.length >= choice.count) {
        // Replace oldest selection when limit reached
        return [...prev.slice(1), instanceId];
      }
      return [...prev, instanceId];
    });
  };

  const canConfirm =
    selected.length === Math.min(choice.count, choice.candidates.length);

  const sourceLabel = (source: "graveyard" | "deck") =>
    source === "graveyard" ? "🪦 Cimetière" : "📚 Deck";

  return (
    <div className="cpm-overlay">
      <div className="cpm-modal">
        <div className="cpm-header">
          <span className="cpm-title">🔮 {choice.prompt}</span>
        </div>

        <p className="cpm-hint">
          Sélectionne {Math.min(choice.count, choice.candidates.length)} carte
          {choice.count > 1 ? "s" : ""}
        </p>

        <div className="cpm-grid">
          {choice.candidates.map((c: ClientChoiceCandidate) => {
            const isSelected = selected.includes(c.instanceId);
            return (
              <div
                key={c.instanceId}
                className={["cpm-card", isSelected ? "cpm-card--selected" : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  borderColor: RARITY_COLOR[c.baseCard.rarity] ?? "#666",
                }}
                onClick={() => toggle(c.instanceId)}
              >
                {isSelected && <span className="cpm-check">✓</span>}
                <div className="cpm-source">{sourceLabel(c.source)}</div>
                <div className="cpm-name">{c.baseCard.name}</div>
                <div className="cpm-sub">
                  {c.baseCard.type === "monster"
                    ? `${c.baseCard.atk}⚔ ${c.baseCard.hp}❤`
                    : (c.baseCard.supportType ?? c.baseCard.type)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cpm-actions">
          <button
            className="cpm-btn-confirm"
            disabled={!canConfirm}
            onClick={() => onConfirm(selected)}
          >
            ✅ Confirmer ({selected.length}/
            {Math.min(choice.count, choice.candidates.length)})
          </button>
        </div>
      </div>
    </div>
  );
}
