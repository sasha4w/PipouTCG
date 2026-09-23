import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./Searchbar.css";

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconFilter({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

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
    else onChange("");
  }, [searchOpen]);

  return (
    <div className="search-bar">
      <div className="search-bar__row">
        <button
          className={`search-bar__icon-btn${searchOpen ? " search-bar__icon-btn--active" : ""}`}
          onClick={() => setSearchOpen((o) => !o)}
          aria-label={t("search.aria_search")}
        >
          <IconSearch size={16} />
        </button>

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
          <button
            className={`search-bar__icon-btn${filterOpen ? " search-bar__icon-btn--active" : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
            aria-label={t("search.aria_filter")}
            style={{ position: "relative" }}
          >
            <IconFilter size={16} />
            {hasActiveFilters && !filterOpen && (
              <span className="search-bar__filter-dot" />
            )}
          </button>
        )}
      </div>

      {filters && filterOpen && (
        <div className="search-bar__filters">{filters}</div>
      )}
    </div>
  );
}
