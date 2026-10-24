import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import "./FightHand.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";
import InspectableCard from "./InspectableCard";
import CardInspect from "./CardInspect";
import { fanLayout } from "./fanLayout";

/** Largeur d'une carte de la main (px) — doit suivre .fhand-card. */
const HAND_CARD_WIDTH = 84;
/** Largeur utilisée avant la première mesure (coque mobile 430px). */
const DEFAULT_HAND_WIDTH = 400;

interface Props {
  hand: HandCard[];
  phase: Phase;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  freeSummonInstanceIds: string[];
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  freeSummonInstanceIds,
  onCardClick,
}: Props) {
  const { t } = useTranslation();
  const isInteractive = isMyTurn && (phase === "main" || phase === "end");
  const mustDiscard = phase === "end" && isMyTurn && hand.length > 7;

  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const inspected =
    inspectedId !== null
      ? hand.find((c) => c.instanceId === inspectedId)
      : undefined;

  // ── Largeur disponible pour l'éventail ────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_HAND_WIDTH);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const slots = fanLayout(hand.length, width, HAND_CARD_WIDTH);

  return (
    <div className="fhand" ref={containerRef}>
      {hand.map((card, idx) => {
        const isSelected = selectedCard === idx;
        const isPaying = payIndices.includes(idx);
        const isPayable =
          !isSelected && selectedCard !== null && phase === "main";
        const isFree = freeSummonInstanceIds.includes(card.instanceId);
        const slot = slots[idx];

        return (
          <InspectableCard
            key={card.instanceId}
            card={card}
            size="xs"
            className={[
              "fhand-card",
              isSelected ? "fhand-card--selected" : "",
              isPaying ? "fhand-card--paying" : "",
              isInteractive ? "fhand-card--interactive" : "",
              isPayable && !isPaying ? "fhand-card--payable" : "",
              phase === "end" && isMyTurn ? "fhand-card--discard-hint" : "",
              isFree ? "fhand-card--free" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                marginLeft: slot.marginLeft,
                zIndex: idx,
                "--fan-rotate": `${slot.rotateDeg}deg`,
                "--fan-y": `${slot.offsetY}px`,
              } as CSSProperties
            }
            onClick={isInteractive ? () => onCardClick(idx, card) : undefined}
            onInspect={() => setInspectedId(card.instanceId)}
            onInspectEnd={() => setInspectedId(null)}
          >
            {isFree && (
              <span className="fhand-free-label">
                {t("fight.hand.free")} ⚡
              </span>
            )}
            {isPaying && (
              <div className="fhand-pay-badge" title={t("fight.hand.payCard")}>
                💰
              </div>
            )}
            {isSelected && <div className="fhand-selected-badge">✓</div>}
            {mustDiscard && (
              <div className="fhand-discard-label">
                {t("fight.hand.discard")}
              </div>
            )}
          </InspectableCard>
        );
      })}

      {inspected && (
        <CardInspect card={inspected} onClose={() => setInspectedId(null)} />
      )}
    </div>
  );
}
