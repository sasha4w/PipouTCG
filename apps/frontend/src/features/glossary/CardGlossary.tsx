import { useState } from "react";
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
  KIND_LABELS,
  NO_FILTERS,
  cardKind,
  matchesFilters,
  setsOf,
  shortSetName,
  useCardCatalog,
} from "./cardCatalog";
import "./CardGlossary.css";

interface Props {
  onBack: () => void;
}

/** Toutes les cartes du jeu, filtrables, avec leurs effets rédigés comme en combat. */
export default function CardGlossary({ onBack }: Props) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [inspected, setInspected] = useState<Card | null>(null);

  const cardsQuery = useCardCatalog();
  const cards = cardsQuery.data?.data ?? [];
  const visible = cards.filter((c) => matchesFilters(c, filters));

  if (cardsQuery.isPending)
    return <Loading message="Chargement des cartes..." />;

  return (
    <div className="cg">
      <div className="cg__header">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          aria-label="Retour"
          onClick={() => {
            soundService.play("cancel");
            onBack();
          }}
        >
          <IconArrowLeft size={16} />
        </Button>
        <h2 className="cg__title">Glossaire</h2>
        <span className="cg__count">
          {visible.length} carte{visible.length > 1 ? "s" : ""}
        </span>
      </div>

      <CardFilterBar
        filters={filters}
        sets={setsOf(cards)}
        onChange={setFilters}
      />

      {cardsQuery.isError && (
        <div className="cg__state cg__state--error">
          Impossible de charger les cartes
        </div>
      )}
      {!cardsQuery.isError && visible.length === 0 && (
        <div className="cg__state">Aucune carte ne correspond.</div>
      )}

      <ul className="cg__list">
        {visible.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="cg__row"
              aria-label={`Voir ${card.name}`}
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
                  {KIND_LABELS[cardKind(card)]} · {shortSetName(card.cardSet.name)}
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
