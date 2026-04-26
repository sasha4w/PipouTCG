import type { HandCard } from "./FightHand";
import { RARITY_COLOR } from "./fight.types";
import "./SummonCostModal.css";
interface Props {
  card: HandCard;
  hand: HandCard[];
  selectedCardIdx: number;
  recycleEnergy: number;
  payIndices: number[];
  onTogglePay: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
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
}: Props) {
  const totalCost = card.cost ?? 0;
  const fromEnergy = Math.min(recycleEnergy, totalCost);
  const stillNeeded = Math.max(0, totalCost - fromEnergy);
  const handPaid = payIndices.length;
  const canConfirm = handPaid >= stillNeeded;

  return (
    <div className="scm-overlay" onClick={onClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <span className="scm-title">Invoquer — {card.name}</span>
          <button className="scm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="scm-cost-row">
          <span className="scm-cost-item">
            Coût total : <strong>{totalCost}⚡</strong>
          </span>
          <span className="scm-cost-item">
            Énergie : <strong>{fromEnergy}⚡</strong>
          </span>
          <span
            className={`scm-cost-item ${handPaid >= stillNeeded ? "scm-cost-ok" : "scm-cost-missing"}`}
          >
            Cartes à défausser :{" "}
            <strong>
              {handPaid}/{stillNeeded}
            </strong>
          </span>
        </div>

        <p className="scm-hint">
          Sélectionne {stillNeeded} carte{stillNeeded > 1 ? "s" : ""} à recycler
          depuis ta main
        </p>

        <div className="scm-hand-grid">
          {hand.map((c, idx) => {
            if (idx === selectedCardIdx) return null;
            const isPaying = payIndices.includes(idx);
            return (
              <div
                key={`${c.id}-${idx}`}
                className={["scm-card", isPaying ? "scm-card--selected" : ""]
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
                    : (c.supportType ?? c.type)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="scm-actions">
          <button className="scm-btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="scm-btn-confirm"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            ⬆️ Recycler &amp; Invoquer
          </button>
        </div>
      </div>
    </div>
  );
}
