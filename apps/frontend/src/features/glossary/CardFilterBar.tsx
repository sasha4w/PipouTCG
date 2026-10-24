import { useState } from "react";
import { useTranslation } from "react-i18next";
import { soundService } from "../../services/sound.service";
import type { Card } from "../../services/card.service";
import {
  KINDS,
  RARITIES,
  SORT_KEYS,
  advancedFilterCount,
  archetypesOf,
  costsOf,
  setsOf,
  shortSetName,
  type CardFilters,
  type SortKey,
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

function IconSliders() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function IconSortDir({ desc }: { desc: boolean }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: desc ? "scaleY(-1)" : undefined }}
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

interface Props {
  filters: CardFilters;
  /** Cartes filtrables : les choix proposés (sets, coûts…) en découlent. */
  cards: readonly Card[];
  onChange: (filters: CardFilters) => void;
}

/** Recherche, tri et filtres, partagés par le glossaire et l'éditeur de deck. */
export default function CardFilterBar({ filters, cards, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const advanced = advancedFilterCount(filters);

  const choose = (patch: Partial<CardFilters>) => {
    soundService.play("select");
    onChange({ ...filters, ...patch });
  };

  /** Une rangée de puces à choix unique ; un second appui désélectionne. */
  const chipRow = <V extends string | number>(
    label: string,
    options: readonly V[],
    current: V | null,
    labelOf: (v: V) => string,
    apply: (v: V | null) => Partial<CardFilters>,
  ) => (
    <div className="cg__group">
      <span className="cg__group-label">{label}</span>
      <div className="cg__chips">
        {options.map((v) => (
          <button
            key={v}
            type="button"
            className="cg__chip"
            aria-pressed={current === v}
            onClick={() => choose(apply(current === v ? null : v))}
          >
            {labelOf(v)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="cg__toolbar">
        <label className="cg__search">
          <IconSearch />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t("glossary.search")}
            aria-label={t("glossary.search")}
          />
        </label>
        <button
          type="button"
          className="cg__tool"
          aria-expanded={open}
          aria-label={t("glossary.filters")}
          data-active={advanced > 0 || undefined}
          onClick={() => {
            soundService.play("select");
            setOpen((o) => !o);
          }}
        >
          <IconSliders />
          {advanced > 0 && <span className="cg__badge">{advanced}</span>}
        </button>
      </div>

      <div className="cg__sort">
        <label className="cg__sort-label">
          {t("glossary.sort")}
          <select
            value={filters.sort}
            onChange={(e) => choose({ sort: e.target.value as SortKey })}
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`glossary.sortKey.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="cg__tool cg__tool--sm"
          aria-label={t(filters.desc ? "glossary.desc" : "glossary.asc")}
          title={t(filters.desc ? "glossary.desc" : "glossary.asc")}
          onClick={() => choose({ desc: !filters.desc })}
        >
          <IconSortDir desc={filters.desc} />
        </button>
      </div>

      <div className="cg__chips">
        <button
          type="button"
          className="cg__chip"
          aria-pressed={filters.setId === null}
          onClick={() => choose({ setId: null })}
        >
          {t("glossary.all")}
        </button>
        {setsOf(cards).map((s) => (
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
            {t(`glossary.kind.${k}`)}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="cg__panel"
          role="group"
          aria-label={t("glossary.filters")}
        >
          {chipRow(
            t("glossary.rarity"),
            RARITIES,
            filters.rarity,
            (r) => t(`rarity.${r}`),
            (rarity) => ({ rarity }),
          )}
          {chipRow(
            t("glossary.archetype"),
            archetypesOf(cards),
            filters.archetype,
            (a) => t(`effects.archetype.${a}`),
            (archetype) => ({ archetype }),
          )}
          {chipRow(
            t("glossary.cost"),
            costsOf(cards),
            filters.cost,
            String,
            (cost) => ({ cost }),
          )}
          {advanced > 0 && (
            <button
              type="button"
              className="cg__reset"
              onClick={() =>
                choose({ rarity: null, archetype: null, cost: null })
              }
            >
              {t("filter.reset")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
