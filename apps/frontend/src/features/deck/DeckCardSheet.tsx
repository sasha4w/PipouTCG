import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { DECK_RULES } from "@pipou/shared";
import type { Card } from "../../services/card.service";
import { soundService } from "../../services/sound.service";
import BottomSheet from "../../components/BottomSheet";
import { IconArrowLeft, IconArrowRight } from "../../components/Icons";
import CardFace from "../cards/CardFace";
import CardEffectSheet from "../fight/CardEffectSheet";
import { cardKind, shortSetName } from "../glossary/cardCatalog";
import "./DeckCardSheet.css";

/** Glissement horizontal minimal (px) pour changer de carte. */
const SWIPE_MIN = 50;

interface Props {
  card: Card;
  owned: number;
  inDeck: number;
  /** Plus grand nombre d'exemplaires possible (possédés, plafond, place restante). */
  maxQty: number;
  onSetQty: (qty: number) => void;
  /** Absent : pas de carte avant / après dans la liste d'origine. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Rang dans la liste d'origine (« 3 / 24 »), absent si la carte n'y est plus. */
  position?: { index: number; total: number };
  onClose: () => void;
}

/** Fiche d'une carte du deck builder : effets complets et nombre d'exemplaires. */
export default function DeckCardSheet({
  card,
  owned,
  inDeck,
  maxQty,
  onSetQty,
  onPrev,
  onNext,
  position,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  const qtyOptions = Array.from(
    { length: DECK_RULES.MAX_COPIES + 1 },
    (_, i) => i,
  );

  return (
    <BottomSheet
      title={card.name}
      closeLabel={t("deck.sheet.close")}
      onClose={onClose}
    >
      <div
        className="dcs"
        onTouchStart={(e) => {
          const p = e.touches[0];
          touchStart.current = { x: p.clientX, y: p.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const p = e.changedTouches[0];
          const dx = p.clientX - start.x;
          const dy = p.clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
          if (dx < 0) onNext?.();
          else onPrev?.();
        }}
      >
        <div className="dcs__top">
          <div className="dcs__face">
            <CardFace card={card} size="sm" />
          </div>
          <div className="dcs__info">
            <div className="dcs__meta">
              {t(`glossary.kind.${cardKind(card)}`)} ·{" "}
              {shortSetName(card.cardSet.name)}
            </div>
            <div className="dcs__owned">
              {t("deck.sheet.owned", { count: owned })}
            </div>
            <div
              className="dcs__qty"
              role="radiogroup"
              aria-label={t("deck.sheet.qty")}
            >
              {qtyOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={inDeck === n}
                  className="dcs__qty-btn"
                  disabled={n > maxQty && n !== inDeck}
                  onClick={() => {
                    if (n === inDeck) return;
                    soundService.play("select");
                    onSetQty(n);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <CardEffectSheet sources={[{ card }]} />

        <div className="dcs__nav">
          <button
            type="button"
            className="dcs__nav-btn"
            aria-label={t("deck.sheet.prev")}
            disabled={!onPrev}
            onClick={onPrev}
          >
            <IconArrowLeft size={16} />
          </button>
          {position && (
            <span className="dcs__pos">
              {position.index + 1} / {position.total}
            </span>
          )}
          <button
            type="button"
            className="dcs__nav-btn"
            aria-label={t("deck.sheet.next")}
            disabled={!onNext}
            onClick={onNext}
          >
            <IconArrowRight size={16} />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
