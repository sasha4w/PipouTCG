import { useState } from "react";
import type { ReactNode } from "react";
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
import {
  IconCards,
  IconCheck,
  IconChevronDown,
  IconHand,
  IconSkull,
  IconSparkles,
  IconTarget,
  IconTrash,
} from "../../components/Icons";
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

const RESOLUTION_ICON: Record<PendingChoiceResolution, ReactNode> = {
  pick_to_hand: <IconSparkles size={16} />,
  discard: <IconTrash size={16} />,
  summon_to_zone: null,
  copy_effects: null,
  transfer_atk_source: null,
  transfer_atk_target: null,
  force_evolve: null,
};

const RESOLUTION_CONFIRM_ICON: Record<PendingChoiceResolution, ReactNode> = {
  pick_to_hand: <IconCheck size={16} />,
  discard: <IconTrash size={16} />,
  summon_to_zone: null,
  copy_effects: null,
  transfer_atk_source: null,
  transfer_atk_target: null,
  force_evolve: null,
};

/** Couleur de fond de l'en-tête selon la nature de l'action */
const RESOLUTION_HEADER_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#fdf6f9",
  discard: "#fff5f5",
  summon_to_zone: "#fdf6f9",
  copy_effects: "#f4f1fb",
  transfer_atk_source: "#fdf6f9",
  transfer_atk_target: "#fdf6f9",
  force_evolve: "#fdf6f9",
};

const RESOLUTION_HEADER_COLOR: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
  summon_to_zone: "#7a1c3b",
  copy_effects: "#4b2a85",
  transfer_atk_source: "#7a1c3b",
  transfer_atk_target: "#7a1c3b",
  force_evolve: "#7a1c3b",
};

const RESOLUTION_BTN_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
  summon_to_zone: "#7a1c3b",
  copy_effects: "#4b2a85",
  transfer_atk_source: "#7a1c3b",
  transfer_atk_target: "#7a1c3b",
  force_evolve: "#7a1c3b",
};

const SOURCE_ICON: Record<ClientChoiceCandidate["source"], ReactNode> = {
  graveyard: <IconSkull size={11} />,
  deck: <IconCards size={11} />,
  hand: <IconHand size={11} />,
  board: <IconTarget size={11} />,
};

/** Cartes par page : 2 rangées de 3, sans défilement sur mobile. */
const PAGE_SIZE = 6;

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
  // Réduit : on consulte main, terrain et cimetière derrière le modal
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(0);

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
    (resolution === "summon_to_zone" ? (
      t("fight.summonPick")
    ) : (
      <>
        {RESOLUTION_CONFIRM_ICON[resolution]}
        {t(`fight.pick.confirm.${resolution}`)}
      </>
    ));
  const picks = Math.min(choice.count, choice.candidates.length);
  const headerBg = RESOLUTION_HEADER_BG[resolution];
  const headerColor = RESOLUTION_HEADER_COLOR[resolution];
  const btnBg = RESOLUTION_BTN_BG[resolution];
  const pageCount = Math.max(
    1,
    Math.ceil(choice.candidates.length / PAGE_SIZE),
  );
  // La liste peut raccourcir d'un choix à l'autre : on reste sur une page existante
  const currentPage = Math.min(page, pageCount - 1);
  const visible = choice.candidates.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  // Dans le cadre de l'app (#root), comme BottomSheet : le modal ne déborde pas du format mobile
  return createPortal(
    <div
      className={["cpm-overlay", collapsed ? "cpm-overlay--collapsed" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["cpm-modal", collapsed ? "cpm-modal--collapsed" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {/* ── Header ── */}
        <div className="cpm-header" style={{ background: headerBg }}>
          <span className="cpm-title" style={{ color: headerColor }}>
            <span className="cpm-title-text">
              {icon}
              {promptText(choice, t)}
            </span>
            {collapsed && (
              <span className="cpm-title-count">
                {selected.length}/{picks}
              </span>
            )}
          </span>
          <button
            type="button"
            className="cpm-collapse"
            style={{ color: headerColor }}
            aria-expanded={!collapsed}
            aria-label={t(
              collapsed ? "fight.pick.expand" : "fight.pick.collapse",
            )}
            onClick={() => setCollapsed((c) => !c)}
          >
            <IconChevronDown size={20} />
          </button>
        </div>

        {!collapsed && (
          <p className="cpm-hint">
            {isBoardPick
              ? t("fight.pick.hintTarget")
              : t("fight.pick.hint", { count: picks })}
          </p>
        )}

        {/* ── Grille de cartes ── */}
        <div className="cpm-grid" hidden={collapsed}>
          {visible.map((c: ClientChoiceCandidate) => {
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
                    <IconCheck size={12} />
                  </span>
                )}
                <div className="cpm-source">
                  {SOURCE_ICON[c.source]}
                  {t(`fight.pick.source.${c.source}`)}
                </div>
              </InspectableCard>
            );
          })}
        </div>

        {pageCount > 1 && !collapsed && (
          <div className="cpm-pager">
            <button
              type="button"
              className="cpm-page-btn cpm-page-btn--prev"
              style={{ color: headerColor }}
              aria-label={t("fight.pick.prevPage")}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <IconChevronDown size={20} />
            </button>
            <span className="cpm-page-count" aria-live="polite">
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="cpm-page-btn cpm-page-btn--next"
              style={{ color: headerColor }}
              aria-label={t("fight.pick.nextPage")}
              disabled={currentPage === pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <IconChevronDown size={20} />
            </button>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="cpm-actions" hidden={collapsed}>
          {onCancel && (
            <Button variant="danger" onClick={onCancel}>
              {t("fight.pick.cancel")}
            </Button>
          )}
          {/* Effet d'une Charge : le joueur peut ne pas l'appliquer */}
          {choice.skippable && (
            <button className="cpm-btn-skip" onClick={() => onConfirm([])}>
              {t("fight.pick.skip")}
            </button>
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
    document.getElementById("root") ?? document.body,
  );
}
