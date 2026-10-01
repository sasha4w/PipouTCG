import { useTranslation } from "react-i18next";
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
  defaultValue?: string;
}

// ✅ Ajout de ces alias pour que BuyTab.tsx ne soit plus en erreur
export type FilterConfig = FilterGroupConfig;
export type FilterValues = Record<string, string>;

export interface FilterPanelProps {
  config: FilterGroupConfig[];
  values: FilterValues;
  onChange: (key: string, value: string) => void;
  /** Affiche un bouton « Réinitialiser » quand il est fourni. */
  onReset?: () => void;
}

// ── Composant ────────────────────────────────────────────────────────────────

export default function FilterPanel({
  config,
  values,
  onChange,
  onReset,
}: FilterPanelProps) {
  const { t } = useTranslation();
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
                  type="button"
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
      {onReset && (
        <button type="button" className="filter-panel__reset" onClick={onReset}>
          {t("filter.reset")}
        </button>
      )}
    </div>
  );
}
