import { useState } from "react";
import type {
  PendingChoice,
  ClientChoiceCandidate,
  PendingChoiceResolution,
} from "./fight.types";
import { RARITY_COLOR } from "./fight.types";
import "./CardPickModal.css";

interface Props {
  choice: PendingChoice;
  onConfirm: (instanceIds: string[]) => void;
}

// ── Helpers par résolution ────────────────────────────────────────────────────

const RESOLUTION_ICON: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "🔮",
  destroy_ally: "💥",
  return_to_hand: "↩️",
  force_attack_enemy: "🔒",
};

const RESOLUTION_CONFIRM: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "✅ Récupérer",
  destroy_ally: "💥 Détruire",
  return_to_hand: "↩️ Retourner en main",
  force_attack_enemy: "🔒 Verrouiller en Attaque",
};

/** Couleur de fond de l'en-tête selon la nature de l'action */
const RESOLUTION_HEADER_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#fdf6f9",
  destroy_ally: "#fff5f5",
  return_to_hand: "#f5f8ff",
  force_attack_enemy: "#fffbf0",
};

const RESOLUTION_HEADER_COLOR: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  destroy_ally: "#c0392b",
  return_to_hand: "#2471a3",
  force_attack_enemy: "#d35400",
};

const RESOLUTION_BTN_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  destroy_ally: "#c0392b",
  return_to_hand: "#2471a3",
  force_attack_enemy: "#d35400",
};

function sourceLabel(
  source: "graveyard" | "deck" | "board",
  resolution?: PendingChoiceResolution,
): string {
  if (source === "graveyard") return "🪦 Cimetière";
  if (source === "deck") return "📚 Deck";
  // board — label according to context
  if (resolution === "destroy_ally") return "🗡 Terrain allié";
  if (resolution === "return_to_hand") return "↩️ Terrain allié";
  if (resolution === "force_attack_enemy") return "⚔️ Terrain ennemi";
  return "🎴 Terrain";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CardPickModal({ choice, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const resolution = choice.resolution ?? "pick_to_hand";
  const isBoardPick =
    resolution === "destroy_ally" ||
    resolution === "return_to_hand" ||
    resolution === "force_attack_enemy";

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
  const confirmLabel = RESOLUTION_CONFIRM[resolution];
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
                  isBoardPick
                    ? `cpm-card--board cpm-card--board-${resolution}`
                    : "",
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
                <div className="cpm-source">
                  {sourceLabel(c.source, resolution)}
                </div>

                <div className="cpm-name">{c.baseCard.name}</div>

                <div className="cpm-sub">
                  {c.baseCard.type === "monster"
                    ? `${c.baseCard.atk}⚔ ${c.baseCard.hp}❤`
                    : (c.baseCard.supportType ?? c.baseCard.type)}
                </div>

                {/* Pour les board picks : indicateur visuel de l'action */}
                {isBoardPick && (
                  <div
                    className="cpm-action-hint"
                    style={{ color: headerColor }}
                  >
                    {resolution === "destroy_ally" && "→ sera détruit"}
                    {resolution === "return_to_hand" && "→ retour en main"}
                    {resolution === "force_attack_enemy" && "→ forcé ⚔️"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Actions ── */}
        <div className="cpm-actions">
          <button
            className="cpm-btn-confirm"
            style={canConfirm ? { background: btnBg } : undefined}
            disabled={!canConfirm}
            onClick={() => onConfirm(selected)}
          >
            {confirmLabel} ({selected.length}/
            {Math.min(choice.count, choice.candidates.length)})
          </button>
        </div>
      </div>
    </div>
  );
}
