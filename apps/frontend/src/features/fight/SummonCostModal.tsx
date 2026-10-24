import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { IconClose, IconReleve } from "../../components/Icons";
import type { HandCard } from "./handCard";
import { RARITY_COLOR } from "./fight.types";
import "./SummonCostModal.css";

/** Alliés proposés pour la Relève (sous-ensemble d'un monstre en jeu). */
export interface ReleveAlly {
  instanceId: string;
  name: string;
  atk: number;
  hp: number;
}

interface Props {
  card: HandCard;
  hand: HandCard[];
  selectedCardIdx: number;
  recycleEnergy: number;
  payIndices: number[];
  onTogglePay: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  /** Coût d'évolution : remplace card.cost et passe la fenêtre en mode évolution. */
  costOverride?: number;
  /**
   * Relève possible : N alliés à choisir. `lockedId` : l'allié de la zone
   * visée, coché d'office (le monstre arrive à sa place) ; le paiement normal
   * n'est alors pas proposé.
   */
  releve?: {
    needed: number;
    allies: ReleveAlly[];
    lockedId?: string;
    onConfirm: (instanceIds: string[]) => void;
  };
}

export default function SummonCostModal({
  card,
  hand,
  selectedCardIdx,
  recycleEnergy,
  payIndices,
  onTogglePay,
  onConfirm,
  onClose,
  costOverride,
  releve,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"pay" | "releve">(
    releve?.lockedId ? "releve" : "pay",
  );
  const [chosen, setChosen] = useState<string[]>(
    releve?.lockedId ? [releve.lockedId] : [],
  );
  const toggleAlly = (id: string) => {
    if (id === releve?.lockedId) return;
    setChosen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isEvolution = costOverride !== undefined;
  const totalCost = costOverride ?? card.cost ?? 0;
  const fromEnergy = Math.min(recycleEnergy, totalCost);
  const stillNeeded = Math.max(0, totalCost - fromEnergy);
  const handPaid = payIndices.length;
  const canConfirm = handPaid >= stillNeeded;

  // Hors du plateau : un ancêtre empilé y placerait la main et le HUD par-dessus
  return createPortal(
    <div className="scm-overlay" onClick={onClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <span className="scm-title">
            {t(
              isEvolution ? "fight.summon.evolveTitle" : "fight.summon.title",
              {
                name: card.name,
              },
            )}
          </span>
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("fight.summon.close")}
            onClick={onClose}
          >
            <IconClose size={16} />
          </Button>
        </div>

        {releve && !releve.lockedId && (
          <div className="scm-mode-row">
            <Button
              variant="ghost-bordeaux"
              active={mode === "pay"}
              onClick={() => setMode("pay")}
            >
              {t("fight.releve.payMode")}
            </Button>
            <Button
              variant="ghost-bordeaux"
              active={mode === "releve"}
              onClick={() => setMode("releve")}
            >
              <IconReleve size={14} /> {t("fight.releve.mode")}
            </Button>
          </div>
        )}

        {releve && mode === "releve" ? (
          <>
            <p className="scm-hint">
              {t("fight.releve.hint", { count: releve.needed })}
            </p>
            <div className="scm-hand-grid">
              {releve.allies.map((a) => {
                const selected = chosen.includes(a.instanceId);
                return (
                  <div
                    key={a.instanceId}
                    className={[
                      "scm-card",
                      selected ? "scm-card--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleAlly(a.instanceId)}
                  >
                    <div className="scm-card-name">{a.name}</div>
                    <div className="scm-card-sub">
                      {t("fight.releve.stats", { atk: a.atk, hp: a.hp })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="scm-actions">
              <Button
                variant="danger"
                className="scm-btn-cancel"
                onClick={onClose}
              >
                {t("fight.summon.cancel")}
              </Button>
              <Button
                className="scm-btn-confirm"
                disabled={chosen.length !== releve.needed}
                onClick={() => releve.onConfirm(chosen)}
              >
                {t("fight.releve.confirm")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="scm-cost-row">
              <span className="scm-cost-item">
                {t("fight.summon.totalCost")} <strong>{totalCost}⚡</strong>
              </span>
              <span className="scm-cost-item">
                {t("fight.summon.energy")} <strong>{fromEnergy}⚡</strong>
              </span>
              <span
                className={`scm-cost-item ${handPaid >= stillNeeded ? "scm-cost-ok" : "scm-cost-missing"}`}
              >
                {t("fight.summon.toDiscard")}{" "}
                <strong>
                  {handPaid}/{stillNeeded}
                </strong>
              </span>
            </div>

            <p className="scm-hint">
              {t("fight.summon.hint", { count: stillNeeded })}
            </p>

            <div className="scm-hand-grid">
              {hand.map((c, idx) => {
                if (idx === selectedCardIdx) return null;
                const isPaying = payIndices.includes(idx);
                return (
                  <div
                    key={`${c.id}-${idx}`}
                    className={[
                      "scm-card",
                      isPaying ? "scm-card--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ borderColor: RARITY_COLOR[c.rarity] ?? "#666" }}
                    onClick={() => onTogglePay(idx)}
                  >
                    {isPaying && <span className="scm-check">✓</span>}
                    <div className="scm-card-name">{c.name}</div>
                    <div className="scm-card-sub">
                      {c.type === "monster"
                        ? `${c.atk}⚔ ${c.hp}❤`
                        : t(`glossary.kind.${c.supportType ?? "EPHEMERAL"}`)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="scm-actions">
              <Button
                variant="danger"
                className="scm-btn-cancel"
                onClick={onClose}
              >
                {t("fight.summon.cancel")}
              </Button>
              <Button
                className="scm-btn-confirm"
                disabled={!canConfirm}
                onClick={onConfirm}
              >
                {isEvolution
                  ? t("fight.summon.confirmEvolve")
                  : `⬆️ ${t("fight.summon.confirm")}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
