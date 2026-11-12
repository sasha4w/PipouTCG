import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import { IconFilter, IconSearch } from "./Icons";
import "./Searchbar.css";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  hasActiveFilters?: boolean;
  extra?: ReactNode;
}

export default function SearchBar({
  value,
  onChange,
  placeholder,
  filters,
  hasActiveFilters = false,
  extra,
}: SearchBarProps) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Fermer la recherche la vide (et seulement à ce moment-là, pas au montage)
  const toggleSearch = () => {
    if (searchOpen) onChange("");
    setSearchOpen(!searchOpen);
  };

  return (
    <div className="search-bar">
      <div className="search-bar__row">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          active={searchOpen}
          aria-label={t("search.aria_search")}
          onClick={toggleSearch}
        >
          <IconSearch size={16} />
        </Button>

        <div
          className={`search-bar__input-wrap${searchOpen ? " search-bar__input-wrap--open" : ""}`}
        >
          <input
            ref={inputRef}
            className="search-bar__input"
            type="text"
            placeholder={placeholder ?? t("search.placeholder")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {extra && <div className="search-bar__extra">{extra}</div>}
        {filters && (
          <Button
            variant="ghost-bordeaux"
            size="icon"
            active={filterOpen}
            aria-label={t("search.aria_filter")}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {hasActiveFilters && !filterOpen && (
              <span className="search-bar__filter-dot" />
            )}
          </Button>
        )}
      </div>

      {filters && filterOpen && (
        <div className="search-bar__filters">{filters}</div>
      )}
    </div>
  );
}
