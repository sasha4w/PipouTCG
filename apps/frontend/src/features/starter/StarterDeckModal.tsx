import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  STARTER_GOLD,
  STARTER_FEATURED_COUNT,
  type Archetype,
  type StarterStatus,
} from "@pipou/shared";
import type { Card } from "../../services/card.service";
import { starterDeckService } from "../../services/starterDeck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import type { ToastType } from "../../hooks/useToast";
import Button from "../../components/Button";
import {
  IconArrowLeft,
  IconClose,
  IconGift,
  IconGold,
  IconPartyHorn,
} from "../../components/Icons";
import CardFace from "../cards/CardFace";
import CardInspect from "../fight/CardInspect";
import { useCardCatalog } from "../glossary/cardCatalog";
import StarterDeckCardList, {
  type StarterListEntry,
} from "./StarterDeckCardList";
import { STARTER_ORDER, starterTextKey } from "./starterTexts";
import "../glossary/CardGlossary.css";
import "./StarterDeckModal.css";

type Phase = "browse" | "list" | "confirm" | "done";

interface Props {
  status: StarterStatus;
  onClose: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Après un choix, tout ce que le starter change côté compte. */
const REFRESHED_KEYS = [
  QUERY_KEYS.profile,
  QUERY_KEYS.myStats,
  QUERY_KEYS.starterStatus,
  QUERY_KEYS.inventory,
  QUERY_KEYS.collection,
  QUERY_KEYS.decks,
];

export default function StarterDeckModal({ status, onClose, addToast }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [archetype, setArchetype] = useState<Archetype>(STARTER_ORDER[0]);
  const [phase, setPhase] = useState<Phase>("browse");
  const [error, setError] = useState("");
  const [inspected, setInspected] = useState<Card | null>(null);
  const claiming = useRef(false);

  const catalog = useCardCatalog();
  const cardsById = new Map((catalog.data?.data ?? []).map((c) => [c.id, c]));

  const deck = status.decks.find((d) => d.archetype === archetype);
  const entries: StarterListEntry[] = (deck?.cards ?? []).flatMap((entry) => {
    const card = cardsById.get(entry.cardId);
    return card ? [{ card, quantity: entry.quantity }] : [];
  });
  const featured = (deck?.cards ?? [])
    .filter((c) => c.isFeatured)
    .slice(0, STARTER_FEATURED_COUNT)
    .flatMap((entry) => {
      const card = cardsById.get(entry.cardId);
      return card ? [card] : [];
    });
  const total = (deck?.cards ?? []).reduce((sum, c) => sum + c.quantity, 0);

  const textKey = starterTextKey(archetype);
  const name = t(`${textKey}.name`);

  const claim = useMutation({
    mutationFn: (choice: Archetype) => starterDeckService.claim(choice),
    onSuccess: () => {
      REFRESHED_KEYS.forEach((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
      setPhase("done");
    },
    onError: (e) => {
      setError(apiErrorMessage(e) ?? t("starter.error"));
      setPhase("browse");
    },
    onSettled: () => {
      claiming.current = false;
    },
  });

  const handleConfirm = () => {
    if (claiming.current) return;
    claiming.current = true;
    setError("");
    claim.mutate(archetype);
  };

  const handleClose = () => {
    if (claiming.current) return;
    if (phase !== "done") addToast(t("starter.closed_hint"), "warning");
    onClose();
  };

  const goldOffered = t("starter.gold_offered", { gold: STARTER_GOLD });

  return (
    <div
      className="sdm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        className="sdm-modal"
        role="dialog"
        aria-label={t("starter.title")}
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
      >
        {!claim.isPending && (
          <Button
            variant="ghost-gold"
            size="icon"
            aria-label={t("starter.close")}
            className="sdm-close"
            onClick={handleClose}
          >
            <IconClose size={16} />
          </Button>
        )}

        <AnimatePresence mode="wait">
          {phase === "browse" && (
            <motion.div key="browse" className="sdm-content" {...fade}>
              <div className="sdm-header">
                <IconGift size={22} color="#eebc77" />
                <h2 className="sdm-title">{t("starter.title")}</h2>
              </div>

              <div className="sdm-tabs" role="tablist">
                {STARTER_ORDER.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    aria-selected={a === archetype}
                    className="sdm-tab"
                    onClick={() => setArchetype(a)}
                  >
                    {t(`${starterTextKey(a)}.name`)}
                  </button>
                ))}
              </div>

              <div className={`sdm-hero sdm-hero--${archetype}`}>
                <span className="sdm-hero__name">{name}</span>
                <span className="sdm-hero__gold">
                  <IconGold size={14} color="#c8960c" />
                  {goldOffered}
                </span>
              </div>

              <p className="sdm-text">{t(`${textKey}.gameplay`)}</p>

              {featured.length > 0 && (
                <div className="sdm-fan">
                  {featured.map((card, i) => (
                    <button
                      key={card.id}
                      type="button"
                      className="sdm-fan__card"
                      style={{
                        transform: `rotate(${(i - (featured.length - 1) / 2) * 6}deg)`,
                      }}
                      aria-label={t("glossary.view", { name: card.name })}
                      onClick={() => setInspected(card)}
                    >
                      <CardFace card={card} size="xs" />
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="sdm-error">{error}</p>}

              <Button
                variant="ghost-gold"
                fullWidth
                onClick={() => setPhase("list")}
              >
                {t("starter.see_cards", { count: total })}
              </Button>
              <Button
                variant="primary-inverse"
                size="lg"
                fullWidth
                onClick={() => setPhase("confirm")}
              >
                {t("starter.choose", { name })}
              </Button>
            </motion.div>
          )}

          {phase === "list" && (
            <motion.div key="list" className="sdm-content" {...fade}>
              <div className="sdm-header">
                <Button
                  variant="ghost-gold"
                  size="icon"
                  aria-label={t("starter.back")}
                  onClick={() => setPhase("browse")}
                >
                  <IconArrowLeft size={16} />
                </Button>
                <h2 className="sdm-title">
                  {name} · {t("starter.cards_count", { count: total })}
                </h2>
              </div>
              <div className="sdm-list-scroll">
                <StarterDeckCardList
                  entries={entries}
                  onInspect={setInspected}
                />
              </div>
              <Button
                variant="primary-inverse"
                size="lg"
                fullWidth
                onClick={() => setPhase("confirm")}
              >
                {t("starter.choose", { name })}
              </Button>
            </motion.div>
          )}

          {phase === "confirm" && (
            <motion.div key="confirm" className="sdm-content" {...fade}>
              <div className="sdm-header">
                <IconGift size={22} color="#eebc77" />
                <h2 className="sdm-title">{t("starter.confirm_title")}</h2>
              </div>
              <p className="sdm-text">
                {t("starter.confirm_text", { name, gold: STARTER_GOLD })}
              </p>
              <Button
                variant="primary-inverse"
                size="lg"
                fullWidth
                disabled={claim.isPending}
                onClick={handleConfirm}
              >
                {t("starter.confirm")}
              </Button>
              <Button
                variant="ghost-gold"
                fullWidth
                disabled={claim.isPending}
                onClick={() => setPhase("browse")}
              >
                {t("starter.back")}
              </Button>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done" className="sdm-content" {...fade}>
              <div className="sdm-header">
                <IconPartyHorn size={22} color="#c8960c" />
                <h2 className="sdm-title">
                  {t("starter.done_title", { name })}
                </h2>
              </div>
              <p className="sdm-hero__gold">
                <IconGold size={14} color="#c8960c" />
                {goldOffered}
              </p>
              <h3 className="sdm-subtitle">{t("starter.how_to_play")}</h3>
              <ul className="sdm-howto">
                {t(`${textKey}.how_to_play`)
                  .split("\n")
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
              </ul>
              <Button
                variant="primary-inverse"
                size="lg"
                fullWidth
                onClick={handleClose}
              >
                {t("starter.done_button")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {inspected && (
        <CardInspect card={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
