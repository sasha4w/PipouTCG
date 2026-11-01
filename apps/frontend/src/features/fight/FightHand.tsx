import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { IconBolt, IconCheck, IconReleve } from "../../components/Icons";
import "./FightHand.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";
import InspectableCard from "./InspectableCard";
import CardDrawer from "./CardDrawer";
import { fanLayout } from "./fanLayout";

/** Largeur d'une carte de la main (px) — doit suivre .fhand-card. */
const HAND_CARD_WIDTH = 64;
/** Largeur utilisée avant la première mesure (coque mobile 430px). */
const DEFAULT_HAND_WIDTH = 400;

interface Props {
  hand: HandCard[];
  phase: Phase;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  freeSummonInstanceIds: string[];
  /** Cartes dont la Relève est disponible (assez d'alliés Pipou). */
  releveInstanceIds?: ReadonlySet<string>;
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  freeSummonInstanceIds,
  releveInstanceIds,
  onCardClick,
}: Props) {
  const { t } = useTranslation();
  const isInteractive = isMyTurn && (phase === "main" || phase === "end");

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
            selected={isSelected}
            onInfo={() => setInspectedId(card.instanceId)}
          >
            {isFree && (
              <span className="fhand-free-label">
                {t("fight.hand.free")} <IconBolt size={8} />
              </span>
            )}
            {isPaying && (
              <div className="fhand-pay-badge" title={t("fight.hand.payCard")}>
                <IconBolt size={10} />
              </div>
            )}
            {isSelected && (
              <div className="fhand-selected-badge">
                <IconCheck size={9} />
              </div>
            )}
            {releveInstanceIds?.has(card.instanceId) && (
              <span
                className="fhand-releve-badge"
                aria-label={t("fight.hand.releve")}
                title={t("fight.hand.releve")}
              >
                <IconReleve size={11} />
              </span>
            )}
          </InspectableCard>
        );
      })}

      {inspected && (
        <CardDrawer card={inspected} onClose={() => setInspectedId(null)} />
      )}
    </div>
  );
}
