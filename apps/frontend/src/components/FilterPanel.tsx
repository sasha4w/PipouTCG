import "./FilterPanel.css";
import { useState, useMemo, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroupConfig {
  key: string;
  label: string;
  options: FilterOption[];
  defaultValue?: string;
}

// ✅ Ajout de ces alias pour que BuyTab.tsx ne soit plus en erreur
export type FilterConfig = FilterGroupConfig;
export type FilterValues = Record<string, string>;

export interface FilterPanelProps {
  config: FilterGroupConfig[];
  values: FilterValues;
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

export function useFilters(config: FilterGroupConfig[]) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(config.map((g) => [g.key, g.defaultValue ?? "all"])),
    [config], // ✅ Ajout de config ici pour plus de sécurité
  );

  const [filterValues, setFilterValues] = useState<FilterValues>(defaults);

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
