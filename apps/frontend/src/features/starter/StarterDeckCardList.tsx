import { useTranslation } from "react-i18next";
import type { Card } from "../../services/card.service";
import CardFace from "../cards/CardFace";
import CardEffectsText from "../glossary/CardEffectsText";
import { cardKind } from "../glossary/cardCatalog";

export interface StarterListEntry {
  card: Card;
  quantity: number;
}

interface Props {
  entries: StarterListEntry[];
  onInspect: (card: Card) => void;
}

/** Liste complète d'un starter deck : face, effets et quantité de chaque carte. */
export default function StarterDeckCardList({ entries, onInspect }: Props) {
  const { t } = useTranslation();
  return (
    <ul className="cg__list sdm-list">
      {entries.map(({ card, quantity }) => (
        <li key={card.id}>
          <button
            type="button"
            className="cg__row"
            aria-label={t("glossary.view", { name: card.name })}
            onClick={() => onInspect(card)}
          >
            <div className="cg__thumb">
              <CardFace card={card} size="xs" />
            </div>
            <div className="cg__body">
              <div className="cg__name">{card.name}</div>
              <div className="cg__meta">
                {t(`glossary.kind.${cardKind(card)}`)}
              </div>
              <CardEffectsText card={card} />
            </div>
            <span className="sdm-qty">×{quantity}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
