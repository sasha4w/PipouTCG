import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { IconBooster, IconPartyHorn, IconSparkles } from "../../components/Icons";
import CardDisplay from "../cards/CardDisplay";
import type {
  BundleBooster,
  OpenedCard,
} from "../../services/opening.service";
import { soundService } from "../../services/sound.service";
import { RARITY_GLOW, bestRarity, sortForSummary, toCard } from "./openingPlan";

interface OpeningSummaryProps {
  cards: OpenedCard[];
  boosters?: BundleBooster[];
  onClose: () => void;
}

export function OpeningSummary({ cards, boosters = [], onClose }: OpeningSummaryProps) {
  const { t } = useTranslation();
  const sorted = useMemo(() => sortForSummary(cards), [cards]);
  const glow = RARITY_GLOW[bestRarity(cards)] ?? RARITY_GLOW.common;

  useEffect(() => {
    soundService.play("confirm");
  }, []);

  return (
    <div className="opening-results">
      <div
        className="opening-results__title"
        style={{ textShadow: `0 0 20px ${glow}` }}
      >
        <IconPartyHorn size={20} /> {t("opening.results")}
      </div>

      {sorted.length > 0 && (
        <div className="opening-results__grid" data-testid="summary-grid">
          {sorted.map((c, i) => (
            <div key={`${c.id}-${i}`} className="opening-results__item">
              <CardDisplay
                card={toCard(c)}
                size="sm"
                interactive={false}
                flippable={false}
              />
              <span className="opening-results__item-name">{c.name}</span>
              {c.isNew && (
                <span
                  className="opening-cards__new-badge opening-results__new"
                  data-testid="summary-new"
                >
                  <IconSparkles size={10} /> {t("opening.new")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {boosters.length > 0 && (
        <div className="opening-results__items-list">
          {boosters.map((b, i) => (
            <div key={`res-booster-${i}`} className="opening-results__item-row">
              <span className="opening-results__item-icon">
                <IconBooster size={20} />
              </span>
              <span className="opening-results__item-label">{b.name}</span>
              {b.quantity > 1 && (
                <span className="opening-results__item-qty">x{b.quantity}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Button variant="primary-inverse" size="lg" onClick={onClose}>
        {t("opening.close")}
      </Button>
    </div>
  );
}
