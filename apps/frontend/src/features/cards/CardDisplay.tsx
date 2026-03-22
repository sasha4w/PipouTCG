import { useRef, useState, useCallback, useEffect } from "react";
import type { Card } from "../../services/card.service";
import "./CardDisplay.css";

const SUPPORT_TYPE_LABELS: Record<string, string> = {
  EPHEMERAL: "Éphémère",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
};

// ── Verso ─────────────────────────────────────────────────────────────────────
function CardBack() {
  return (
    <div className="pipou-card__back">
      <svg
        className="pipou-card__back-svg"
        viewBox="0 0 384 383.999986"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M329.402344 73.835938 L296.46875 343.015625 C295.890625 347.753906 293.449219 352.070312 289.691406 355.011719 C285.929688 357.949219 281.15625 359.277344 276.417969 358.695312 L67.996094 333.195312 C63.257812 332.617188 58.945312 330.179688 56.003906 326.417969 C53.0625 322.660156 51.738281 317.882812 52.316406 313.144531 L85.25 43.964844 C85.832031 39.226562 88.269531 34.914062 92.027344 31.972656 C95.789062 29.035156 100.5625 27.707031 105.300781 28.285156 L313.722656 53.785156 C318.460938 54.367188 322.773438 56.804688 325.714844 60.566406 C328.65625 64.324219 329.980469 69.101562 329.402344 73.835938Z"
          fill="#fdfbf2"
          stroke="#3d1020"
          strokeWidth="5"
          opacity="0.45"
        />
        <path
          d="M289.84375 44.066406 L306.164062 314.761719 C306.453125 319.527344 304.835938 324.210938 301.667969 327.78125 C298.503906 331.355469 294.046875 333.523438 289.28125 333.808594 L79.6875 346.445312 C74.921875 346.734375 70.238281 345.117188 66.667969 341.949219 C63.09375 338.785156 60.925781 334.328125 60.636719 329.5625 L44.320312 58.867188 C44.03125 54.105469 45.648438 49.417969 48.816406 45.847656 C51.980469 42.273438 56.4375 40.105469 61.199219 39.820312 L270.796875 27.183594 C275.5625 26.894531 280.246094 28.511719 283.816406 31.679688 C287.390625 34.847656 289.558594 39.300781 289.84375 44.066406Z"
          fill="#fdfbf2"
          stroke="#3d1020"
          strokeWidth="5"
          opacity="0.72"
        />
        <path
          d="M312.5 57.898438 L312.5 329.085938 C312.5 333.859375 310.601562 338.4375 307.226562 341.8125 C303.851562 345.1875 299.273438 347.082031 294.5 347.082031 L84.523438 347.082031 C79.75 347.082031 75.171875 345.1875 71.796875 341.8125 C68.421875 338.4375 66.527344 333.859375 66.527344 329.085938 L66.527344 57.898438 C66.527344 53.125 68.421875 48.546875 71.796875 45.171875 C75.171875 41.796875 79.75 39.898438 84.523438 39.898438 L294.5 39.898438 C299.273438 39.898438 303.851562 41.796875 307.226562 45.171875 C310.601562 48.546875 312.5 53.125 312.5 57.898438Z"
          fill="#fdfbf2"
          stroke="#3d1020"
          strokeWidth="5"
        />
        <g fill="#3d1020">
          <path
            transform="translate(101.684492, 237.590621)"
            d="M 104.609375 -30.90625 C 104.609375 -33.164062 105.507812 -35.085938 107.3125 -36.671875 C 109.125 -38.265625 112.179688 -39.0625 116.484375 -39.0625 C 124.410156 -39.0625 128.375 -35.4375 128.375 -28.1875 L 128.375 -22.421875 C 128.375 -7.472656 119.769531 0 102.5625 0 L 41.4375 0 C 24.90625 0 16.640625 -8.035156 16.640625 -24.109375 L 16.640625 -120.90625 C 16.640625 -137.4375 25.019531 -145.703125 41.78125 -145.703125 L 102.5625 -145.703125 C 119.769531 -145.703125 128.375 -138.226562 128.375 -123.28125 L 128.375 -118.1875 C 128.375 -110.039062 124.410156 -105.96875 116.484375 -105.96875 C 108.566406 -105.96875 104.609375 -108.570312 104.609375 -113.78125 C 104.609375 -126.226562 97.703125 -132.453125 83.890625 -132.453125 L 60.796875 -132.453125 C 47.210938 -132.453125 40.421875 -126.566406 40.421875 -114.796875 L 40.421875 -29.890625 C 40.421875 -18.335938 47.097656 -12.5625 60.453125 -12.5625 L 84.5625 -12.5625 C 97.925781 -12.5625 104.609375 -18.675781 104.609375 -30.90625Z"
          />
        </g>
      </svg>
    </div>
  );
}

interface CardDisplayProps {
  card: Card;
  size?: "sm" | "md" | "lg";
  flippable?: boolean;
  interactive?: boolean;
}

// ── Durée max d'un tap (ms) — au-delà = long press ───────────────────────────
const TAP_THRESHOLD_MS = 250;
// Déplacement max pour rester un tap (px)
const TAP_MOVE_PX = 8;
// Délai avant activation de l'inspection (ms)
const LONG_PRESS_MS = 200;

export default function CardDisplay({
  card,
  size = "md",
  flippable = false,
  interactive = true,
}: CardDisplayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [active, setActive] = useState(false);
  const rafRef = useRef<number>(0);

  // ── État touch ────────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInspectingRef = useRef(false);
  const lastTouchEndRef = useRef<number>(0); // timestamp du dernier touchend

  const isSupport = card.type?.toLowerCase() === "support";
  const supportLabel = card.supportType
    ? (SUPPORT_TYPE_LABELS[card.supportType] ?? card.supportType)
    : null;

  // ── Helpers 3D ────────────────────────────────────────────────────────────
  const apply3D = useCallback((clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current!.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const mx = (x / rect.width) * 100;
      const my = (y / rect.height) * 100;
      const rx = (x / rect.width - 0.5) * 30;
      const ry = (0.5 - y / rect.height) * 30;
      const hyp = Math.min(Math.sqrt((mx - 50) ** 2 + (my - 50) ** 2) / 50, 1);
      const el = cardRef.current!;
      el.style.setProperty("--mx", `${mx}%`);
      el.style.setProperty("--my", `${my}%`);
      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--ry", `${ry}deg`);
      el.style.setProperty("--posx", `${mx}%`);
      el.style.setProperty("--posy", `${my}%`);
      el.style.setProperty("--pos", `${mx}% ${my}%`);
      el.style.setProperty("--hyp", `${hyp}`);
      el.style.setProperty("--o", "1");
    });
  }, []);

  const reset3D = useCallback(() => {
    if (!cardRef.current) return;
    cancelAnimationFrame(rafRef.current);
    const el = cardRef.current;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--o", "0");
    el.style.setProperty("--hyp", "0");
  }, []);

  // ── Souris (PC) ────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || flipped) return; // ← pas de 3D quand flippée
      apply3D(e.clientX, e.clientY);
    },
    [interactive, flipped, apply3D],
  );

  const handleMouseLeave = useCallback(() => {
    reset3D();
    setActive(false);
  }, [reset3D]);

  // ── Touch (mobile) ────────────────────────────────────────────────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!interactive && !flippable) return;
      if (flipped) return; // ← pas d'inspection quand flippée (dos visible)
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isInspectingRef.current = false;

      // Démarre le long press après LONG_PRESS_MS
      if (interactive) {
        longPressTimerRef.current = setTimeout(() => {
          isInspectingRef.current = true;
          setActive(true);
          if (touchStartRef.current)
            apply3D(touchStartRef.current.x, touchStartRef.current.y);
        }, LONG_PRESS_MS);
      }
    },
    [interactive, flippable, apply3D],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!interactive || !touchStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const moved = Math.sqrt(dx * dx + dy * dy);

      // Si on bouge trop tôt → annule le long press
      if (!isInspectingRef.current && moved > TAP_MOVE_PX) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        return;
      }

      // En mode inspection → applique l'effet 3D
      if (isInspectingRef.current) {
        e.preventDefault(); // évite le scroll pendant l'inspection
        apply3D(touch.clientX, touch.clientY);
      }
    },
    [interactive, apply3D],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      const wasInspecting = isInspectingRef.current;
      isInspectingRef.current = false;
      setActive(false);
      reset3D();

      // Si c'était un tap court (pas d'inspection) → flip
      if (!wasInspecting && flippable && touchStartRef.current) {
        const duration = Date.now() - touchStartRef.current.time;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const moved = Math.sqrt(dx * dx + dy * dy);

        if (duration < TAP_THRESHOLD_MS && moved < TAP_MOVE_PX) {
          setFlipped((f) => !f);
        }
      }

      lastTouchEndRef.current = Date.now();
      touchStartRef.current = null;
    },
    [flippable, reset3D],
  );

  // Nettoyage au démontage
  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const rarity = card.rarity.toLowerCase();

  return (
    <div
      ref={cardRef}
      className={["pipou-card", `pipou-card--${size}`, active ? "active" : ""]
        .filter(Boolean)
        .join(" ")}
      data-rarity={rarity}
      // ── PC ──
      onMouseMove={handleMouseMove}
      onMouseEnter={() => interactive && setActive(true)}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        // Ignore le click fantôme qui suit un touchend (< 500ms)
        if (Date.now() - lastTouchEndRef.current < 500) return;
        if (flippable) {
          reset3D(); // ← reset le 3D avant de flip
          setActive(false);
          setFlipped((f) => !f);
        }
      }}
      // ── Mobile ──
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role={flippable ? "button" : undefined}
      aria-label={flippable ? `Retourner ${card.name}` : card.name}
      style={{ touchAction: "pan-y" }} // laisse scroller verticalement sauf si inspection
    >
      <div className="pipou-card__translater">
        <div
          className="pipou-card__rotator"
          style={{
            transform: flipped
              ? "rotateY(180deg)"
              : `rotateY(var(--rx)) rotateX(var(--ry))`,
          }}
          tabIndex={0}
        >
          {/* ══ RECTO ══ */}
          <div className="pipou-card__front">
            <div className="pipou-card__header">
              <div className="pipou-card__name">{card.name}</div>
              <div className="pipou-card__cost">{card.cost}</div>
            </div>

            <div className="pipou-card__image-wrap">
              {card.image?.url ? (
                <img
                  className="pipou-card__image"
                  src={card.image.url}
                  alt={card.name}
                  loading="lazy"
                />
              ) : (
                <div className="pipou-card__image-placeholder">✦</div>
              )}

              {!isSupport && (
                <div className="pipou-card__stats-overlay">
                  <div className="pipou-card__stat-badge">
                    <span className="pipou-card__stat-label">ATK</span>
                    <span className="pipou-card__stat-value">{card.atk}</span>
                  </div>
                  <div className="pipou-card__stat-badge">
                    <span className="pipou-card__stat-label">HP</span>
                    <span className="pipou-card__stat-value">{card.hp}</span>
                  </div>
                </div>
              )}

              {isSupport && supportLabel && (
                <div className="pipou-card__support-badge">{supportLabel}</div>
              )}
            </div>

            <div className="pipou-card__footer">
              {card.description ? (
                <div className="pipou-card__description">
                  {card.description}
                </div>
              ) : (
                <div
                  className="pipou-card__description"
                  style={{ opacity: 0.3 }}
                >
                  —
                </div>
              )}
              <div className="pipou-card__id-row">
                <span className="pipou-card__id">#{card.id}</span>
              </div>
            </div>

            <div className="pipou-card__shine" />
            <div className="pipou-card__glare" />
          </div>

          {/* ══ VERSO ══ */}
          <CardBack />
        </div>
      </div>

      {/* ── Hint mobile : indique le long press ── */}
      {flippable && (
        <div className="pipou-card__mobile-hint" aria-hidden="true">
          <span className="pipou-card__mobile-hint-dot" />
        </div>
      )}
    </div>
  );
}
