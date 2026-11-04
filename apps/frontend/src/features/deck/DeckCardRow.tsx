import { useTranslation } from "react-i18next";
import type { Card } from "../../services/card.service";
import CardFace from "../cards/CardFace";
import CardEffectsText from "../glossary/CardEffectsText";
import { cardKind, shortSetName } from "../glossary/cardCatalog";
import { IconCheck, IconMinus, IconPlus } from "../../components/Icons";
import "../glossary/CardGlossary.css";
import "./DeckCardRow.css";

interface DeckCardRowProps {
  card: Card;
  inDeck: number;
  copies: number;
  canAdd: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  onOpen: () => void;
}

/** Ligne de la galerie, avec les quantités du deck à droite. */
export default function DeckCardRow({
  card,
  inDeck,
  copies,
  canAdd,
  onAdd,
  onRemove,
  onOpen,
}: DeckCardRowProps) {
  const { t } = useTranslation();
  return (
    <div className={`dcr${inDeck > 0 ? " dcr--in" : ""}`}>
      <button
        type="button"
        className="cg__row dcr__main"
        aria-label={t("glossary.view", { name: card.name })}
        onClick={onOpen}
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
      <div className="dcr__qty">
        {onRemove && (
          <button
            type="button"
            className="dcr__btn"
            aria-label={t("deck.removeOne", { name: card.name })}
            onClick={onRemove}
          >
            <IconMinus size={16} />
          </button>
        )}
        <span className="dcr__count">
          {onRemove ? inDeck : `${inDeck}/${copies}`}
        </span>
        <button
          type="button"
          className="dcr__btn dcr__btn--add"
          aria-label={
            canAdd
              ? t("deck.addOne", { name: card.name })
              : t("deck.full", { name: card.name })
          }
          disabled={!canAdd}
          onClick={onAdd}
        >
          {canAdd ? <IconPlus size={16} /> : <IconCheck size={16} />}
        </button>
      </div>
    </div>
  );
}
