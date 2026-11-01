import { useState, type TouchEvent } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import CardFace, {
  type CardFaceCard,
  type CardFaceStats,
} from "../cards/CardFace";
import type { BuffEntry } from "./BuffDebuffSections";
import CardEffectSheet from "./CardEffectSheet";
import type { InspectCard } from "./CardInspect";
import { describeCardEffects, effectSummary } from "./effectText";
import KeywordIcon from "./KeywordIcon";
import "./CardDrawer.css";

interface Props {
  card: InspectCard;
  stats?: CardFaceStats;
  guard?: boolean;
  /** État en direct d'un monstre en jeu (stats, statuts actifs). */
  status?: BuffEntry[];
  /** Équipements posés sur le monstre inspecté. */
  equipments?: InspectCard[];
  onClose: () => void;
}

/** Distance verticale (px) à partir de laquelle un geste compte comme un glissement. */
const SWIPE_MIN = 40;

/** Tiroir d'info d'une carte : résumé replié, texte complet déplié. */
export default function CardDrawer({
  card,
  stats,
  guard,
  status = [],
  equipments = [],
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  const { keywords } = describeCardEffects(card, t);
  const summary = effectSummary(card, t);
  const shown = stats ?? { atk: card.atk, hp: card.hp };
  const statuses = status.filter((e) => !e.variant);

  const onTouchStart = (e: TouchEvent) => setStartY(e.touches[0].clientY);
  const onTouchEnd = (e: TouchEvent) => {
    if (startY === null) return;
    const delta = e.changedTouches[0].clientY - startY;
    setStartY(null);
    if (delta <= -SWIPE_MIN) setExpanded(true);
    else if (delta >= SWIPE_MIN) onClose();
  };

  return (
    <BottomSheet
      title={card.name}
      closeLabel={t("fight.drawer.close")}
      onClose={onClose}
    >
      <div
        className="cdw-grab"
        data-testid="drawer-grab"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <span className="cdw-handle" aria-hidden="true" />
        <div className="cdw-summary">
          <CardFace
            card={card as CardFaceCard}
            size="md"
            stats={stats}
            guard={guard}
          />
          <div className="cdw-info">
            {card.type === "monster" && (
              <div className="cdw-stats">
                {t("fight.drawer.stats", { atk: shown.atk, hp: shown.hp })}
              </div>
            )}
            {keywords.length > 0 && (
              <ul className="cdw-tags">
                {keywords.map((id) => (
                  <li key={id} className="cdw-tag">
                    <KeywordIcon id={id} size={12} /> {t(`keywords.${id}.name`)}
                  </li>
                ))}
              </ul>
            )}
            {summary && <p className="cdw-line">{summary}</p>}
          </div>
        </div>
      </div>
      {expanded ? (
        <CardEffectSheet
          sources={[
            { card },
            ...equipments.map((eq) => ({ card: eq, title: eq.name })),
          ]}
          statuses={statuses}
        />
      ) : (
        <button
          type="button"
          className="cdw-more"
          onClick={() => setExpanded(true)}
        >
          {t("fight.drawer.seeAll")}
        </button>
      )}
    </BottomSheet>
  );
}
