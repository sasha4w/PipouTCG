import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import { openingAudio } from "./openingAudio";
import { rarityRank } from "./openingPlan";
import "./PackTear.css";

const TEAR_THRESHOLD = 0.96;
const STEP_MS_LOW = 520;
const STEP_MS_HIGH = 760;
const FINAL_PAUSE_MS = 350;
const FINAL_PAUSE_HIGH_MS = 850;
const RARE_RANK = 2;
const LEGENDARY_RANK = 4;

const RARITY_COLORS = [
  "#b0b8b0",
  "#70b870",
  "#6898d8",
  "#9860c8",
  "#d8a030",
  "#c850a0",
] as const;

interface PackTearProps {
  name: string;
  quantity: number;
  /** Null tant que l'API n'a pas répondu. */
  bestRarity: string | null;
  onTorn: () => void;
  onWaitDone: () => void;
}

export function PackTear({
  name,
  quantity,
  bestRarity,
  onTorn,
  onWaitDone,
}: PackTearProps) {
  const { t } = useTranslation();
  const { reduced } = useAnimationPrefs();
  const [progress, setProgress] = useState(0);
  const [torn, setTorn] = useState(false);
  const [step, setStep] = useState(0);

  const tornRef = useRef(false);
  const dragRef = useRef<{ fromLeft: boolean; lastX: number } | null>(null);
  const onTornRef = useRef(onTorn);
  const onWaitDoneRef = useRef(onWaitDone);
  useEffect(() => {
    onTornRef.current = onTorn;
    onWaitDoneRef.current = onWaitDone;
  });

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tornRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fromLeft = e.clientX - rect.left <= rect.width / 2;
    dragRef.current = { fromLeft, lastX: e.clientX };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture indisponible : le glissement reste suivi dans l'élément
    }
  };

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || tornRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const raw = drag.fromLeft
      ? (e.clientX - rect.left) / rect.width
      : (rect.right - e.clientX) / rect.width;
    const p = Math.min(1, Math.max(0, raw));
    const speed = Math.abs(e.clientX - drag.lastX) / rect.width;
    drag.lastX = e.clientX;
    setProgress(p);
    openingAudio.tear(Math.min(1, speed * 8));
    if (p >= TEAR_THRESHOLD) {
      tornRef.current = true;
      dragRef.current = null;
      setTorn(true);
      onTornRef.current();
    }
  };

  const handleEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Déjà relâchée
    }
    if (!tornRef.current) setProgress(0);
  };

  // Paliers : démarrent quand la rareté est connue
  useEffect(() => {
    if (!torn || bestRarity === null) return;
    const maxStep = rarityRank(bestRarity);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const play = (i: number) => {
      setStep(i);
      openingAudio.stepNote(i);
      if (i < maxStep) {
        timer = setTimeout(
          () => play(i + 1),
          i < RARE_RANK ? STEP_MS_LOW : STEP_MS_HIGH,
        );
      } else {
        const pause =
          maxStep >= LEGENDARY_RANK ? FINAL_PAUSE_HIGH_MS : FINAL_PAUSE_MS;
        timer = setTimeout(() => onWaitDoneRef.current(), pause);
      }
    };
    play(0);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [torn, bestRarity]);

  const waiting = torn && bestRarity === null;
  const color = RARITY_COLORS[Math.min(step, RARITY_COLORS.length - 1)];
  const classes = [
    "pack-tear",
    quantity >= 5 ? "pack-tear--big" : "",
    torn ? "pack-tear--torn" : "",
    waiting && !reduced ? "pack-tear--pulse" : "",
    reduced ? "pack-tear--reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ "--tear-color": color } as CSSProperties}
    >
      <div className="pack-tear__stage">
        <div className="pack-tear__stack" aria-hidden="true" />
        <div className="pack-tear__body">
          <span className="pack-tear__name">{name}</span>
          {quantity > 1 && (
            <span className="pack-tear__badge">×{quantity}</span>
          )}
        </div>
        <div
          data-testid="pack-tear-strip"
          className="pack-tear__strip"
          role="presentation"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleEnd}
          onPointerCancel={handleEnd}
        >
          <div
            className="pack-tear__cut"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      {!torn && <p className="pack-tear__hint">{t("opening.tearHint")}</p>}
    </div>
  );
}
