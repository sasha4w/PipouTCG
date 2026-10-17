import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cardService, type Card } from "../../services/card.service";
import { soundService } from "../../services/sound.service";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconArrowLeft } from "../../components/Icons";
import CardFace from "../cards/CardFace";
import CardInspect from "../fight/CardInspect";
import { describeCardEffects } from "../fight/effectText";
import { renderEffectText } from "../fight/renderEffectText";
import { QUERY_KEYS } from "../../utils/querykeys";
import "./CardGlossary.css";

/** Toutes les cartes tiennent en une page (plafond du back : 500). */
const GLOSSARY_LIMIT = 500;

type Kind = "monster" | "EQUIPMENT" | "TERRAIN" | "EPHEMERAL";

const KIND_LABELS: Record<Kind, string> = {
  monster: "Monstre",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
  EPHEMERAL: "Éphémère",
};
const KINDS = Object.keys(KIND_LABELS) as Kind[];

function cardKind(card: Card): Kind {
  if (card.type.toLowerCase() !== "support") return "monster";
  return (card.supportType as Kind | null | undefined) ?? "EPHEMERAL";
}

/** « Drakon - Les légendes primaires » → « Drakon ». */
function shortSetName(name: string): string {
  return name.split(/\s[-–]\s/)[0];
}

/** Minuscules sans accents ni ligatures : « oeuf » trouve « Œuf ». */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function IconSearch() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

interface Props {
  onBack: () => void;
}

/** Toutes les cartes du jeu, filtrables, avec leurs effets rédigés comme en combat. */
export default function CardGlossary({ onBack }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [setId, setSetId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [inspected, setInspected] = useState<Card | null>(null);

  const cardsQuery = useQuery({
    queryKey: QUERY_KEYS.cardGlossary,
    queryFn: () => cardService.findAll(1, GLOSSARY_LIMIT),
  });
  const cards = cardsQuery.data?.data ?? [];

  const sets = [
    ...new Map(cards.map((c) => [c.cardSet.id, c.cardSet])).values(),
  ].sort((a, b) => a.id - b.id);

  const query = normalize(search.trim());
  const visible = cards.filter(
    (c) =>
      (setId === null || c.cardSet.id === setId) &&
      (kind === null || cardKind(c) === kind) &&
      normalize(c.name).includes(query),
  );

  const choose = (apply: () => void) => {
    soundService.play("select");
    apply();
  };

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

      <label className="cg__search">
        <IconSearch />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une carte…"
          aria-label="Rechercher une carte"
        />
      </label>

      <div className="cg__chips">
        <button
          type="button"
          className="cg__chip"
          aria-pressed={setId === null}
          onClick={() => choose(() => setSetId(null))}
        >
          Tous
        </button>
        {sets.map((s) => (
          <button
            key={s.id}
            type="button"
            className="cg__chip"
            aria-pressed={setId === s.id}
            onClick={() => choose(() => setSetId(s.id))}
          >
            {shortSetName(s.name)}
          </button>
        ))}
      </div>
      <div className="cg__chips">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="cg__chip"
            aria-pressed={kind === k}
            onClick={() => choose(() => setKind(kind === k ? null : k))}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {cardsQuery.isError && (
        <div className="cg__state cg__state--error">
          Impossible de charger les cartes
        </div>
      )}
      {!cardsQuery.isError && visible.length === 0 && (
        <div className="cg__state">Aucune carte ne correspond.</div>
      )}

      <ul className="cg__list">
        {visible.map((card) => {
          const { rules } = describeCardEffects(card, t);
          return (
            <li key={card.id}>
              <button
                type="button"
                className="cg__row"
                aria-label={`Voir ${card.name}`}
                onClick={() => choose(() => setInspected(card))}
              >
                <div className="cg__thumb">
                  <CardFace card={card} size="xs" />
                </div>
                <div className="cg__body">
                  <div className="cg__name">{card.name}</div>
                  <div className="cg__meta">
                    {KIND_LABELS[cardKind(card)]} · {shortSetName(card.cardSet.name)}
                  </div>
                  {rules.length > 0 ? (
                    <p className="cg__effects">
                      {rules.map((rule, i) => (
                        <span key={i}>
                          <span className="cg__trigger">{rule.trigger} : </span>
                          {rule.lines.map((line, j) => (
                            <span key={j}>{renderEffectText(line.text)} </span>
                          ))}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="cg__effects cg__effects--none">Aucun effet</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {inspected && (
        <CardInspect card={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
