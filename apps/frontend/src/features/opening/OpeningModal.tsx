import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  openingService,
  type OpenedCard,
  type OpeningResult,
} from "../../services/opening.service";
import CardDisplay from "../cards/CardDisplay";
import type { Card } from "../../services/card.service";
import "./OpeningModal.css";

// ── Rareté → couleur ─────────────────────────────────────────────────────────
const RARITY_ORDER = [
  "secret",
  "legendary",
  "epic",
  "rare",
  "uncommon",
  "common",
];

const RARITY_FLASH: Record<string, string> = {
  common: "rgba(176,184,176,0.6)",
  uncommon: "rgba(112,184,112,0.6)",
  rare: "rgba(104,152,216,0.7)",
  epic: "rgba(152, 96,200,0.7)",
  legendary: "rgba(216,160, 48,0.8)",
  secret: "rgba(200, 80,160,0.85)",
};

const RARITY_GLOW: Record<string, string> = {
  common: "#b0b8b0",
  uncommon: "#70b870",
  rare: "#6898d8",
  epic: "#9860c8",
  legendary: "#d8a030",
  secret: "#c850a0",
};

function getMaxRarity(cards: OpenedCard[]): string {
  for (const r of RARITY_ORDER) {
    if (cards.some((c) => c.rarity.toLowerCase() === r)) return r;
  }
  return "common";
}

function toCard(c: OpenedCard): Card {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity as Card["rarity"],
    type: c.type as Card["type"],
    supportType: (c.supportType as Card["supportType"]) ?? null,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    description: c.description ?? undefined,
    image: c.image,
    cardSet: { id: 0, name: "" },
  };
}

type Phase = "idle" | "flash" | "revealing" | "results";

export interface OpeningTarget {
  type: "booster" | "bundle";
  id: number;
  name: string;
}

interface OpeningModalProps {
  target: OpeningTarget;
  onClose: () => void;
  onDone?: () => void;
}

export default function OpeningModal({
  target,
  onClose,
  onDone,
}: OpeningModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError] = useState("");

  const icon = target.type === "booster" ? "📦" : "🎁";
  const cards = result?.cards ?? [];
  const maxRarity = getMaxRarity(cards);
  const flashColor = RARITY_FLASH[maxRarity] ?? RARITY_FLASH.common;
  const glowColor = RARITY_GLOW[maxRarity] ?? RARITY_GLOW.common;

  const handleOpen = async () => {
    setError("");
    setPhase("flash");
    try {
      const res =
        target.type === "booster"
          ? await openingService.openBooster(target.id)
          : await openingService.openBundle(target.id);
      setResult(res);
      setTimeout(() => {
        setCurrentIdx(0);
        setPhase("revealing");
      }, 900);
    } catch {
      setError("Erreur lors de l'ouverture.");
      setPhase("idle");
    }
  };

  const handleNext = () => {
    if (currentIdx < cards.length - 1) setCurrentIdx((i) => i + 1);
    else setPhase("results");
  };

  const handleClose = () => {
    if (phase === "results") onDone?.();
    onClose();
  };

  return (
    <div
      className="opening-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "flash") handleClose();
      }}
    >
      {/* Flash coloré selon rareté max */}
      <AnimatePresence>
        {phase === "flash" && (
          <motion.div
            className="opening-flash"
            style={{
              background: flashColor,
              boxShadow: `0 0 120px 60px ${flashColor}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
          />
        )}
      </AnimatePresence>

      <div className="opening-modal">
        {phase !== "flash" && (
          <button className="opening-modal__close" onClick={handleClose}>
            ✕
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── Pack fermé ── */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="opening-pack"
              exit={{ scale: 2, opacity: 0, filter: "brightness(3)" }}
              transition={{ duration: 0.35 }}
            >
              <motion.div
                className="opening-pack__icon"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                }}
                onClick={handleOpen}
                whileTap={{ scale: 0.9 }}
                style={{ cursor: "pointer" }}
              >
                {icon}
              </motion.div>
              <div className="opening-pack__name">{target.name}</div>
              <div className="opening-pack__hint">Appuie pour ouvrir !</div>
              {error && <p className="opening-modal__error">{error}</p>}
            </motion.div>
          )}

          {/* ── Révélation une par une ── */}
          {phase === "revealing" && cards[currentIdx] && (
            <motion.div
              key="revealing"
              className="opening-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.button
                className="opening-skip-btn"
                onClick={() => setPhase("results")}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Skip →
              </motion.button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIdx}
                  className="opening-reveal__card"
                  initial={{ opacity: 0, scale: 0.7, y: 40 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -20 }}
                  transition={{ type: "spring", damping: 16, stiffness: 200 }}
                  onClick={handleNext}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="opening-reveal__glow"
                    style={{
                      boxShadow: `0 0 40px 15px ${RARITY_GLOW[cards[currentIdx].rarity.toLowerCase()] ?? "#fff"}55`,
                    }}
                  />
                  <CardDisplay
                    card={toCard(cards[currentIdx])}
                    size="md"
                    interactive
                    flippable={false}
                  />
                </motion.div>
              </AnimatePresence>

              <motion.div
                key={"info-" + currentIdx}
                className="opening-reveal__info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="opening-cards__name">
                  {cards[currentIdx].name}
                </span>
                <span
                  className={`opening-cards__rarity opening-cards__rarity--${cards[currentIdx].rarity.toLowerCase()}`}
                  style={{
                    color: RARITY_GLOW[cards[currentIdx].rarity.toLowerCase()],
                  }}
                >
                  {cards[currentIdx].rarity}
                </span>
                {cards[currentIdx].isNew && (
                  <span className="opening-cards__new-badge">
                    ✨ Nouvelle !
                  </span>
                )}
                <span className="opening-cards__counter">
                  {currentIdx + 1} / {cards.length}
                </span>
              </motion.div>

              <button className="opening-cards__next-btn" onClick={handleNext}>
                {currentIdx < cards.length - 1
                  ? "Carte suivante →"
                  : "Voir les résultats"}
              </button>
            </motion.div>
          )}

          {/* ── Résultats ── */}
          {phase === "results" && (
            <motion.div
              key="results"
              className="opening-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div
                className="opening-results__title"
                style={{ textShadow: `0 0 20px ${glowColor}` }}
              >
                🎉 Résultats !
              </div>
              <div className="opening-results__grid">
                {cards.map((c, i) => (
                  <motion.div
                    key={c.id + "-" + i}
                    className="opening-results__item"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: i * 0.06,
                      type: "spring",
                      damping: 14,
                    }}
                  >
                    <CardDisplay
                      card={toCard(c)}
                      size="sm"
                      interactive={false}
                      flippable={false}
                    />
                    <span className="opening-results__item-name">{c.name}</span>
                    {c.isNew && (
                      <span
                        className="opening-cards__new-badge"
                        style={{ fontSize: "0.55rem" }}
                      >
                        ✨ New
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
              <button
                className="opening-results__close-btn"
                onClick={handleClose}
              >
                Fermer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
