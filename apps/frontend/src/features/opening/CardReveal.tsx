import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import Button from "../../components/Button";
import { IconArrowRight } from "../../components/Icons";
import CardDisplay from "../cards/CardDisplay";
import { openingAudio, playRaritySound } from "./openingAudio";
import { RARITY_GLOW, rarityRank, toCard, type RevealStep } from "./openingPlan";
import { RevealEffects, RevealFlash } from "./RevealEffects";
import "./CardReveal.css";

interface CardRevealProps {
  steps: RevealStep[];
  onDone: () => void;
  onSkip: () => void;
}

const TILT_DEG = 12;

export function CardReveal({ steps, onDone, onSkip }: CardRevealProps) {
  const { t } = useTranslation();
  const { reduced } = useAnimationPrefs();
  const [idx, setIdx] = useState(0);
  const [revealedIdx, setRevealedIdx] = useState(-1);
  const tiltRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  const stepsRef = useRef(steps);
  const doneRef = useRef(false);
  useEffect(() => {
    onDoneRef.current = onDone;
    stepsRef.current = steps;
  });

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  const step = steps[idx];
  const hasBlackout = step.ritual === "full" && step.blackoutMs > 0;
  const revealed = !hasBlackout || revealedIdx === idx;
  const rarity = step.card.rarity.toLowerCase();
  const epic = rarityRank(rarity) >= rarityRank("epic");
  const isLast = idx >= steps.length - 1;

  useEffect(() => {
    const cur = stepsRef.current[idx];
    const blackout = cur.ritual === "full" && cur.blackoutMs > 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = () => {
      if (idx >= stepsRef.current.length - 1) {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current();
      } else setIdx(idx + 1);
    };
    const reveal = () => {
      playRaritySound(cur.card.rarity);
      if (cur.ritual !== "none") openingAudio.bass();
      if (cur.autoAdvanceMs != null) {
        timers.push(setTimeout(advance, cur.autoAdvanceMs));
      }
    };
    if (blackout) {
      openingAudio.rumble();
      timers.push(
        setTimeout(() => {
          setRevealedIdx(idx);
          reveal();
        }, cur.blackoutMs),
      );
    } else {
      reveal();
    }
    return () => timers.forEach(clearTimeout);
  }, [idx]);

  const handleAdvance = () => {
    if (!revealed || !step.holdForClick) return;
    if (isLast) finish();
    else setIdx(idx + 1);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAdvance();
    }
  };

  const handleTilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el || reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = r.width ? (e.clientX - r.left) / r.width - 0.5 : 0;
    const py = r.height ? (e.clientY - r.top) / r.height - 0.5 : 0;
    el.style.setProperty("--rx", `${(-py * TILT_DEG).toFixed(1)}deg`);
    el.style.setProperty("--ry", `${(px * TILT_DEG).toFixed(1)}deg`);
  };

  const resetTilt = () => {
    tiltRef.current?.style.removeProperty("--rx");
    tiltRef.current?.style.removeProperty("--ry");
  };

  const classes = [
    "opening-fx",
    `opening-fx--${rarity}`,
    step.ritual === "short" && "opening-fx--short",
    !reduced && epic && "opening-fx--shake",
    reduced && "opening-fx--reduced",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      data-testid="reveal-root"
      style={{ "--fx-color": RARITY_GLOW[rarity] ?? RARITY_GLOW.common } as CSSProperties}
    >
      {idx > 0 && (
        <Button
          variant="ghost-gold"
          size="sm"
          className="opening-fx__skip"
          data-testid="reveal-skip"
          onClick={onSkip}
        >
          {t("opening.skip")} <IconArrowRight size={16} />
        </Button>
      )}

      {!revealed ? (
        <div className="opening-fx__blackout" data-testid="reveal-blackout" />
      ) : (
        <>
        <RevealFlash key={`flash-${idx}`} rarity={rarity} reduced={reduced} />
        <div key={idx} className="opening-fx__stage">
          <RevealEffects rarity={rarity} ritual={step.ritual} reduced={reduced} />
          <div
            className="opening-fx__tilt"
            ref={tiltRef}
            onPointerMove={handleTilt}
            onPointerLeave={resetTilt}
          >
            <div
              className="opening-fx__card"
              data-testid="reveal-card"
              role="button"
              tabIndex={0}
              aria-label={t("opening.revealCard")}
              onClick={handleAdvance}
              onKeyDown={handleKey}
            >
              {rarityRank(rarity) >= 1 && (
                <div className="opening-fx__halo" aria-hidden="true" />
              )}
              <CardDisplay
                card={toCard(step.card)}
                size="md"
                interactive={false}
                flippable={false}
              />
              {epic && <div className="opening-fx__sheen" aria-hidden="true" />}
              {step.card.isNew && (
                <span className="opening-fx__new" data-testid="reveal-new">
                  {t("opening.new")}
                </span>
              )}
            </div>
          </div>
          {epic && (
            <div className="opening-fx__banner" data-testid="reveal-banner">
              {t(`opening.rarity.${rarity}`)}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
