import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Card } from "../../services/card.service";
import { soundService } from "../../services/sound.service";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconArrowLeft } from "../../components/Icons";
import CardFace from "../cards/CardFace";
import CardInspect from "../fight/CardInspect";
import CardFilterBar from "./CardFilterBar";
import CardEffectsText from "./CardEffectsText";
import {
  NO_FILTERS,
  cardKind,
  matchesFilters,
  shortSetName,
  sortCards,
  useCardCatalog,
} from "./cardCatalog";
import "./CardGlossary.css";

interface Props {
  onBack: () => void;
}

const asCard = (c: Card) => c;

/** Toutes les cartes du jeu, filtrables, avec leurs effets rédigés comme en combat. */
export default function CardGlossary({ onBack }: Props) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [inspected, setInspected] = useState<Card | null>(null);

  const cardsQuery = useCardCatalog();
  const cards = cardsQuery.data?.data ?? [];
  const visible = sortCards(
    cards.filter((c) => matchesFilters(c, filters)),
    asCard,
    filters,
  );

  if (cardsQuery.isPending) return <Loading message={t("glossary.loading")} />;

  return (
    <div className="cg">
      <div className="cg__header">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          aria-label={t("glossary.back")}
          onClick={() => {
            soundService.play("cancel");
            onBack();
          }}
        >
          <IconArrowLeft size={16} />
        </Button>
        <h2 className="cg__title">{t("glossary.title")}</h2>
        <span className="cg__count">
          {t("glossary.count", { count: visible.length })}
        </span>
      </div>

      <CardFilterBar filters={filters} cards={cards} onChange={setFilters} />

      {cardsQuery.isError && (
        <div className="cg__state cg__state--error">{t("glossary.error")}</div>
      )}
      {!cardsQuery.isError && visible.length === 0 && (
        <div className="cg__state">{t("glossary.empty")}</div>
      )}

      <ul className="cg__list">
        {visible.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="cg__row"
              aria-label={t("glossary.view", { name: card.name })}
              onClick={() => {
                soundService.play("select");
                setInspected(card);
              }}
            >
              <div className="cg__thumb">
                <CardFace card={card} size="xs" />
              </div>
              <div className="cg__body">
                <div className="cg__name">{card.name}</div>
                <div className="cg__meta">
                  {t(`glossary.kind.${cardKind(card)}`)} ·{" "}
                  {shortSetName(card.cardSet.name)}
                </div>
                <CardEffectsText card={card} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {inspected && (
        <CardInspect card={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
