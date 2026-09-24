import { useState, useRef } from "react";
import "./FightHand.css";
import "./BuffDebuffList.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";
import { RARITY_COLOR, FREE_SUMMON_CARD_ID } from "./fight.types";
import BuffDebuffList from "./BuffDebuffList";
import { getCardEffectEntries } from "./fight.effects";

interface Props {
  hand: HandCard[];
  phase: Phase;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  freeSummonAvailable?: boolean;
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  freeSummonAvailable = false,
  onCardClick,
}: Props) {
  const isInteractive = isMyTurn && (phase === "main" || phase === "end");
  const mustDiscard = phase === "end" && isMyTurn && hand.length > 7;

  // ── Info tooltip ──────────────────────────────────────────────────────────
  const [openInfoIdx, setOpenInfoIdx] = useState<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleInfoClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    e.stopPropagation();
    if (openInfoIdx === idx) {
      setOpenInfoIdx(null);
      setAnchorRect(null);
    } else {
      setOpenInfoIdx(idx);
      setAnchorRect(e.currentTarget.getBoundingClientRect());
    }
  };

  return (
    <div className="fhand">
      {hand.map((card, idx) => {
        const isSelected = selectedCard === idx;
        const isPaying = payIndices.includes(idx);
        const isPayable =
          !isSelected && selectedCard !== null && phase === "main";
        const isFree = freeSummonAvailable && card.id === FREE_SUMMON_CARD_ID;
        const isInfoOpen = openInfoIdx === idx;

        return (
          <div
            key={`${card.id}-${idx}`}
            className={[
              "fhand-card",
              `fhand-card--${card.type}`,
              isSelected ? "fhand-card--selected" : "",
              isPaying ? "fhand-card--paying" : "",
              isInteractive ? "fhand-card--interactive" : "",
              isPayable && !isPaying ? "fhand-card--payable" : "",
              phase === "end" && isMyTurn ? "fhand-card--discard-hint" : "",
              isFree ? "fhand-card--free" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ borderColor: RARITY_COLOR[card.rarity] ?? "#666" }}
            onClick={() => isInteractive && onCardClick(idx, card)}
          >
            {/* ── Badge info ─────────────────────────────────────────────── */}
            <button
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              className={`bdl-trigger fhand-info-btn${isInfoOpen ? " bdl-trigger--active" : ""}`}
              onClick={(e) => handleInfoClick(e, idx)}
              title="Voir les effets"
            >
              i
            </button>

            <div className="fhand-card-cost">
              {isFree ? (
                <span className="fhand-free-label">GRATUIT ⚡</span>
              ) : (
                `${card.cost ?? 0}⚡`
              )}
            </div>

            {isPaying && (
              <div className="fhand-pay-badge" title="Carte de paiement">
                💰
              </div>
            )}
            {isSelected && <div className="fhand-selected-badge">✓</div>}

            <div className="fhand-card-name">{card.name}</div>
            <div className="fhand-card-sub">
              {card.type === "monster"
                ? `${card.atk}⚔ ${card.hp}❤`
                : (card.supportType ?? card.type)}
            </div>

            {mustDiscard && (
              <div className="fhand-discard-label">défausser</div>
            )}
          </div>
        );
      })}

      {/* Tooltip rendu hors du flux des cartes ─────────────────────────── */}
      {openInfoIdx !== null && anchorRect && hand[openInfoIdx] && (
        <BuffDebuffList
          entries={getCardEffectEntries(
            hand[openInfoIdx].effects,
            hand[openInfoIdx].description,
            hand[openInfoIdx].supportType,
          )}
          cardName={hand[openInfoIdx].name}
          supportType={hand[openInfoIdx].supportType}
          anchorRect={anchorRect}
          onClose={() => {
            setOpenInfoIdx(null);
            setAnchorRect(null);
          }}
        />
      )}
    </div>
  );
}
