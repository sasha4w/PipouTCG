import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  openingService,
  type OpenedCard,
  type OpeningResult,
} from "../../services/opening.service";
import CardDisplay from "../cards/CardDisplay";
import type { Card } from "../../services/card.service";
import "./OpeningModal.css";

// ── Rareté → couleur ─────────────────────────────────────────────────────────

/** Du plus rare au moins rare (pour getMaxRarity) */
const RARITY_ORDER_DESC = [
  "secret",
  "legendary",
  "epic",
  "rare",
  "uncommon",
  "common",
];

/** Du moins rare au plus rare (pour la cascade de flash) */
const RARITY_ORDER_ASC = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "secret",
];

const RARITY_FLASH: Record<string, string> = {
  common: "rgba(176,184,176,0.65)",
  uncommon: "rgba(112,184,112,0.65)",
  rare: "rgba(104,152,216,0.72)",
  epic: "rgba(152, 96,200,0.72)",
  legendary: "rgba(216,160, 48,0.82)",
  secret: "rgba(200, 80,160,0.88)",
};

const RARITY_GLOW: Record<string, string> = {
  common: "#b0b8b0",
  uncommon: "#70b870",
  rare: "#6898d8",
  epic: "#9860c8",
  legendary: "#d8a030",
  secret: "#c850a0",
};

/** Renvoie la couleur glow de la rareté maximale trouvée dans les cartes */
function getMaxRarity(cards: OpenedCard[]): string {
  for (const r of RARITY_ORDER_DESC) {
    if (cards.some((c) => c.rarity.toLowerCase() === r)) return r;
  }
  return "common";
}

/**
 * Construit la séquence de couleurs pour le cascade de flash :
 * on retient uniquement les raretés présentes, du plus bas au plus haut.
 * Ex : [common, rare, legendary] → [gris, bleu, or]
 */
function getRarityCascade(cards: OpenedCard[]): string[] {
  const present = new Set(cards.map((c) => c.rarity.toLowerCase()));
  return RARITY_ORDER_ASC.filter((r) => present.has(r)).map(
    (r) => RARITY_FLASH[r],
  );
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

// ── Durée de chaque flash individuel (ms) ────────────────────────────────────
const FLASH_STEP_MS = 380;

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = "idle" | "loading" | "flash" | "revealing" | "results";

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

// ── Composant ─────────────────────────────────────────────────────────────────
export default function OpeningModal({
  target,
  onClose,
  onDone,
}: OpeningModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  // Cascade flash
  const [cascadeColors, setCascadeColors] = useState<string[]>([]);
  const [flashStep, setFlashStep] = useState(0);

  const icon = target.type === "booster" ? "📦" : "🎁";
  const cards = result?.cards ?? [];
  const maxRarity = getMaxRarity(cards);
  const glowColor = RARITY_GLOW[maxRarity] ?? RARITY_GLOW.common;

  // ── Cascade automatique ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "flash") return;

    // Tous les flashes ont été joués → passer à la révélation
    if (flashStep >= cascadeColors.length) {
      const t = setTimeout(() => {
        setCurrentIdx(0);
        setPhase("revealing");
      }, 120);
      return () => clearTimeout(t);
    }

    // Passer au flash suivant après FLASH_STEP_MS
    const t = setTimeout(() => {
      setFlashStep((s) => s + 1);
    }, FLASH_STEP_MS);
    return () => clearTimeout(t);
  }, [phase, flashStep, cascadeColors]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpen = async () => {
    setError("");
    setPhase("loading"); // animation de chargement pendant l'appel API

    try {
      const res =
        target.type === "booster"
          ? await openingService.openBooster(target.id)
          : await openingService.openBundle(target.id);

      setResult(res);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
      // Calculer la cascade de couleurs et démarrer
      const colors = getRarityCascade(res.cards);
      setCascadeColors(colors.length > 0 ? colors : [RARITY_FLASH.common]);
      setFlashStep(0);
      setPhase("flash");
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

  // ── Couleur courante du flash ─────────────────────────────────────────────
  const currentFlashColor =
    flashStep < cascadeColors.length ? cascadeColors[flashStep] : "transparent";

  return (
    <div
      className="opening-overlay"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          phase !== "flash" &&
          phase !== "loading"
        )
          handleClose();
      }}
    >
      {/* ── Cascade de flashes (un par rareté, du plus bas au plus haut) ── */}
      <AnimatePresence>
        {phase === "flash" && flashStep < cascadeColors.length && (
          <motion.div
            key={`flash-${flashStep}`}
            className="opening-flash"
            style={{
              background: currentFlashColor,
              boxShadow: `0 0 160px 80px ${currentFlashColor}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.85] }}
            exit={{ opacity: 0 }}
            transition={{ duration: FLASH_STEP_MS / 1000, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <div className="opening-modal">
        {phase !== "flash" && phase !== "loading" && (
          <button className="opening-modal__close" onClick={handleClose}>
            ✕
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── Pack fermé (idle) ── */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="opening-pack"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ scale: 2.2, opacity: 0, filter: "brightness(4)" }}
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

          {/* ── Chargement (appel API en cours) ── */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              className="opening-pack"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                scale: 3,
                opacity: 0,
                filter: "brightness(5)",
                transition: { duration: 0.25 },
              }}
            >
              <motion.div
                className="opening-pack__icon"
                animate={{
                  rotate: [-4, 4, -6, 6, -3, 3, 0],
                  scale: [1, 1.06, 0.97, 1.08, 0.96, 1.05, 1],
                  y: [0, -4, 0, -6, 0, -3, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.55,
                  ease: "easeInOut",
                }}
              >
                {icon}
              </motion.div>
              <div className="opening-pack__name">{target.name}</div>
              <motion.div
                className="opening-pack__hint"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
              >
                Ouverture en cours…
              </motion.div>
            </motion.div>
          )}

          {/* ── Révélation carte par carte ── */}
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
                      boxShadow: `0 0 40px 15px ${
                        RARITY_GLOW[cards[currentIdx].rarity.toLowerCase()] ??
                        "#fff"
                      }55`,
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
