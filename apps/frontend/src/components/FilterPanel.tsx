/**
 * FilterPanel — composant de filtres réutilisable
 *
 * Utilisation :
 *   const { filterValues, setFilter, resetFilters, hasActiveFilters } = useFilters(filterConfig);
 *   <FilterPanel config={filterConfig} values={filterValues} onChange={setFilter} />
 *
 * Puis dans SearchBar :
 *   <SearchBar ... hasActiveFilters={hasActiveFilters} filters={<FilterPanel ... />} />
 */

import "./FilterPanel.css";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroupConfig {
  key: string;
  label: string;
  options: FilterOption[];
  /** Valeur considérée comme "pas de filtre actif" (défaut: "all") */
  defaultValue?: string;
}

export interface FilterPanelProps {
  config: FilterGroupConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// ── Composant ────────────────────────────────────────────────────────────────

export default function FilterPanel({
  config,
  values,
  onChange,
}: FilterPanelProps) {
  return (
    <div className="filter-panel">
      {config.map((group) => (
        <div key={group.key} className="filter-panel__group">
          <span className="filter-panel__label">{group.label}</span>
          <div className="filter-panel__btns">
            {group.options.map((opt) => {
              const isActive =
                (values[group.key] ?? group.defaultValue ?? "all") ===
                opt.value;
              return (
                <button
                  key={opt.value}
                  className={`filter-panel__btn${isActive ? " filter-panel__btn--active" : ""}`}
                  onClick={() => onChange(group.key, opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hook useFilters ───────────────────────────────────────────────────────────

/**
 * Hook companion pour gérer l'état des filtres.
 *
 *   const { filterValues, setFilter, resetFilters, hasActiveFilters } = useFilters(config);
 */
import { useState, useMemo, useCallback } from "react";

export function useFilters(config: FilterGroupConfig[]) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(config.map((g) => [g.key, g.defaultValue ?? "all"])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [filterValues, setFilterValues] =
    useState<Record<string, string>>(defaults);

  const setFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilterValues(defaults);
  }, [defaults]);

  const hasActiveFilters = useMemo(
    () => config.some((g) => filterValues[g.key] !== (g.defaultValue ?? "all")),
    [config, filterValues],
  );

  return { filterValues, setFilter, resetFilters, hasActiveFilters };
}
