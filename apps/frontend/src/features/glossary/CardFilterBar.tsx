import { soundService } from "../../services/sound.service";
import type { Card } from "../../services/card.service";
import {
  KIND_LABELS,
  KINDS,
  shortSetName,
  type CardFilters,
} from "./cardCatalog";
import "./CardGlossary.css";

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
  filters: CardFilters;
  sets: Card["cardSet"][];
  onChange: (filters: CardFilters) => void;
}

/** Recherche + filtres par set et par type, partagés par le glossaire et l'éditeur de deck. */
export default function CardFilterBar({ filters, sets, onChange }: Props) {
  const choose = (patch: Partial<CardFilters>) => {
    soundService.play("select");
    onChange({ ...filters, ...patch });
  };

  return (
    <>
      <label className="cg__search">
        <IconSearch />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher une carte…"
          aria-label="Rechercher une carte"
        />
      </label>

      <div className="cg__chips">
        <button
          type="button"
          className="cg__chip"
          aria-pressed={filters.setId === null}
          onClick={() => choose({ setId: null })}
        >
          Tous
        </button>
        {sets.map((s) => (
          <button
            key={s.id}
            type="button"
            className="cg__chip"
            aria-pressed={filters.setId === s.id}
            onClick={() => choose({ setId: s.id })}
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
            aria-pressed={filters.kind === k}
            onClick={() => choose({ kind: filters.kind === k ? null : k })}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
    </>
  );
}
