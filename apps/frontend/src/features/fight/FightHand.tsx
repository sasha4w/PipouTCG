import { useState, useEffect, useRef } from "react";
import "./FightHand.css";
import type { Phase } from "./fight.types";
import { RARITY_COLOR } from "./fight.types";

export type HandCard = {
  id: number;
  name: string;
  type: string;
  atk: number;
  hp: number;
  cost: number;
  rarity: string;
  supportType?: string;
};

interface Props {
  hand: HandCard[];
  phase: Phase | undefined;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  onCardClick,
}: Props) {
  const isDiscardPhase = phase === "end" && isMyTurn && hand.length > 7;

  // ── Draw animation ────────────────────────────────────────────────────────
  // Track which indices are freshly drawn
  const prevLengthRef = useRef(hand.length);
  const [drawnIndices, setDrawnIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prev = prevLengthRef.current;
    if (hand.length > prev) {
      // New cards arrived — animate from prev index to end
      const incoming = new Set<number>();
      for (let i = prev; i < hand.length; i++) incoming.add(i);
      setDrawnIndices(incoming);
      const t = setTimeout(() => setDrawnIndices(new Set()), 500);
      prevLengthRef.current = hand.length;
      return () => clearTimeout(t);
    }
    prevLengthRef.current = hand.length;
  }, [hand.length]);

  return (
    <div className="fhand-area">
      <div className="fhand-label">Main ({hand.length})</div>
      <div className="fhand-cards">
        {hand.map((card, idx) => {
          const isPaying = payIndices.includes(idx);
          const isSel = selectedCard === idx;
          const isDrawn = drawnIndices.has(idx);

          return (
            <div
              key={idx}
              className={[
                "fhand-card",
                isSel ? "fhand-card--selected" : "",
                isPaying ? "fhand-card--paying" : "",
                isDiscardPhase ? "fhand-card--discard" : "",
                isDrawn ? "fhand-card--drawn" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onCardClick(idx, card)}
            >
              <div
                className="fhand-rarity"
                style={{ background: RARITY_COLOR[card.rarity] ?? "#888" }}
              />
              <div className="fhand-card-name">{card.name}</div>
              <div className="fhand-card-meta">
                {card.type === "monster"
                  ? `${card.atk}⚔ ${card.hp}❤ ${card.cost}⚡`
                  : `Support · ${card.cost}⚡`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
