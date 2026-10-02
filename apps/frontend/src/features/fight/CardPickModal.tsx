import { useState } from "react";
import type {
  PendingChoice,
  ClientChoiceCandidate,
  PendingChoiceResolution,
} from "./fight.types";
import Button from "../../components/Button";
import { RARITY_COLOR } from "./fight.types";
import "./CardPickModal.css";

interface Props {
  choice: PendingChoice;
  onConfirm: (instanceIds: string[]) => void;
  /** Optionnel — affiché uniquement quand fourni (ex: modal de ciblage interne) */
  onCancel?: () => void;
  /** Remplace le libellé du bouton de confirmation (ex: ciblage d'un Éphémère). */
  confirmLabel?: string;
}

// ── Helpers par résolution ────────────────────────────────────────────────────

const RESOLUTION_ICON: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "🔮",
  discard: "🗑️",
};

const RESOLUTION_CONFIRM: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "✅ Récupérer",
  discard: "🗑️ Défausser",
};

/** Couleur de fond de l'en-tête selon la nature de l'action */
const RESOLUTION_HEADER_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#fdf6f9",
  discard: "#fff5f5",
};

const RESOLUTION_HEADER_COLOR: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
};

const RESOLUTION_BTN_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
};

function sourceLabel(source: ClientChoiceCandidate["source"]): string {
  if (source === "graveyard") return "🪦 Cimetière";
  if (source === "deck") return "📚 Deck";
  if (source === "hand") return "🖐 Main";
  return "🎴 Terrain";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CardPickModal({
  choice,
  onConfirm,
  onCancel,
  confirmLabel,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const resolution = choice.resolution ?? "pick_to_hand";
  const isBoardPick = choice.candidates.every((c) => c.source === "board");

  const toggle = (instanceId: string) => {
    setSelected((prev) => {
      if (prev.includes(instanceId))
        return prev.filter((id) => id !== instanceId);
      if (prev.length >= choice.count) return [...prev.slice(1), instanceId];
      return [...prev, instanceId];
    });
  };

  const canConfirm =
    selected.length === Math.min(choice.count, choice.candidates.length);

  const icon = RESOLUTION_ICON[resolution];
  const confirmText = confirmLabel ?? RESOLUTION_CONFIRM[resolution];
  const headerBg = RESOLUTION_HEADER_BG[resolution];
  const headerColor = RESOLUTION_HEADER_COLOR[resolution];
  const btnBg = RESOLUTION_BTN_BG[resolution];

  return (
    <div className="cpm-overlay">
      <div className="cpm-modal">
        {/* ── Header ── */}
        <div className="cpm-header" style={{ background: headerBg }}>
          <span className="cpm-title" style={{ color: headerColor }}>
            {icon} {choice.prompt}
          </span>
        </div>

        <p className="cpm-hint">
          {isBoardPick
            ? `Sélectionne le monstre cible`
            : `Sélectionne ${Math.min(choice.count, choice.candidates.length)} carte${choice.count > 1 ? "s" : ""}`}
        </p>

        {/* ── Grille de cartes ── */}
        <div className="cpm-grid">
          {choice.candidates.map((c: ClientChoiceCandidate) => {
            const isSelected = selected.includes(c.instanceId);
            const borderColor = RARITY_COLOR[c.baseCard.rarity] ?? "#666";

            return (
              <div
                key={c.instanceId}
                className={[
                  "cpm-card",
                  isSelected ? "cpm-card--selected" : "",
                  isBoardPick ? "cpm-card--board" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  borderColor: isSelected ? headerColor : borderColor,
                }}
                onClick={() => toggle(c.instanceId)}
              >
                {isSelected && (
                  <span
                    className="cpm-check"
                    style={{ background: headerColor }}
                  >
                    {icon}
                  </span>
                )}

                {/* Source badge */}
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

        {/* ── Actions ── */}
        <div className="cpm-actions">
          {onCancel && (
            <Button variant="danger" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <button
            className="cpm-btn-confirm"
            style={canConfirm ? { background: btnBg } : undefined}
            disabled={!canConfirm}
            onClick={() => onConfirm(selected)}
          >
            {confirmText} ({selected.length}/
            {Math.min(choice.count, choice.candidates.length)})
          </button>
        </div>
      </div>
    </div>
  );
}
