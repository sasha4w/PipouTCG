import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { CSSProperties } from "react";
import type {
  PendingChoice,
  ClientChoiceCandidate,
  PendingChoiceResolution,
} from "./fight.types";
import Button from "../../components/Button";
import InspectableCard from "./InspectableCard";
import CardDrawer from "./CardDrawer";
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
  summon_to_zone: "", // pas d'emoji pour les nouveaux écrans
  copy_effects: "",
};

const RESOLUTION_CONFIRM_ICON: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "✅",
  discard: "🗑️",
  summon_to_zone: "",
  copy_effects: "",
};

/** Couleur de fond de l'en-tête selon la nature de l'action */
const RESOLUTION_HEADER_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#fdf6f9",
  discard: "#fff5f5",
  summon_to_zone: "#f3faf5",
  copy_effects: "#f4f1fb",
};

const RESOLUTION_HEADER_COLOR: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
  summon_to_zone: "#1f6b3a",
  copy_effects: "#4b2a85",
};

const RESOLUTION_BTN_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
  summon_to_zone: "#1f6b3a",
  copy_effects: "#4b2a85",
};

const SOURCE_ICON: Record<ClientChoiceCandidate["source"], string> = {
  graveyard: "🪦",
  deck: "📚",
  hand: "🖐",
  board: "🎴",
};

/** Consigne traduite si le serveur fournit sa clé, sinon son texte. */
function promptText(choice: PendingChoice, t: TFunction): string {
  if (!choice.promptKey) return choice.prompt;
  return t(`fight.pick.prompt.${choice.promptKey}`, {
    ...choice.promptParams,
    defaultValue: choice.prompt,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CardPickModal({
  choice,
  onConfirm,
  onCancel,
  confirmLabel,
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [inspected, setInspected] = useState<ClientChoiceCandidate | null>(
    null,
  );
  const [pickedId, setPickedId] = useState<string | null>(null);

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
  const confirmText =
    confirmLabel ??
    (resolution === "summon_to_zone"
      ? t("fight.summonPick")
      : [
          RESOLUTION_CONFIRM_ICON[resolution],
          t(`fight.pick.confirm.${resolution}`),
        ]
          .filter(Boolean)
          .join(" "));
  const picks = Math.min(choice.count, choice.candidates.length);
  const headerBg = RESOLUTION_HEADER_BG[resolution];
  const headerColor = RESOLUTION_HEADER_COLOR[resolution];
  const btnBg = RESOLUTION_BTN_BG[resolution];

  // Hors du plateau : un ancêtre empilé y placerait la main et le HUD par-dessus
  return createPortal(
    <div className="cpm-overlay">
      <div className="cpm-modal">
        {/* ── Header ── */}
        <div className="cpm-header" style={{ background: headerBg }}>
          <span className="cpm-title" style={{ color: headerColor }}>
            {icon} {promptText(choice, t)}
          </span>
        </div>

        <p className="cpm-hint">
          {isBoardPick
            ? t("fight.pick.hintTarget")
            : t("fight.pick.hint", { count: picks })}
        </p>

        {/* ── Grille de cartes ── */}
        <div className="cpm-grid">
          {choice.candidates.map((c: ClientChoiceCandidate) => {
            const isSelected = selected.includes(c.instanceId);
            return (
              <InspectableCard
                key={c.instanceId}
                card={c.baseCard}
                size="sm"
                className={["cpm-card", isSelected ? "cpm-card--selected" : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cpm-accent": headerColor } as CSSProperties}
                selected={pickedId === c.instanceId}
                onClick={() => {
                  setPickedId(c.instanceId);
                  toggle(c.instanceId);
                }}
                onInfo={() => setInspected(c)}
              >
                {isSelected && (
                  <span
                    className="cpm-check"
                    style={{ background: headerColor }}
                  >
                    {icon}
                  </span>
                )}
                <div className="cpm-source">
                  {SOURCE_ICON[c.source]} {t(`fight.pick.source.${c.source}`)}
                </div>
              </InspectableCard>
            );
          })}
        </div>

        {/* ── Actions ── */}
        <div className="cpm-actions">
          {onCancel && (
            <Button variant="danger" onClick={onCancel}>
              {t("fight.pick.cancel")}
            </Button>
          )}
          <button
            className="cpm-btn-confirm"
            style={canConfirm ? { background: btnBg } : undefined}
            disabled={!canConfirm}
            onClick={() => onConfirm(selected)}
          >
            {confirmText} ({selected.length}/{picks})
          </button>
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
  );
}
