import { useTranslation } from "react-i18next";
import Button from "./Button";
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
  /** Fond sur lequel le panneau est pos� (d�faut : clair). */
  tone?: "light" | "dark";
}

// ── Composant ────────────────────────────────────────────────────────────────

export default function FilterPanel({
  config,
  values,
  onChange,
  onReset,
  tone = "light",
}: FilterPanelProps) {
  const { t } = useTranslation();
  const variant = tone === "dark" ? "ghost-gold" : "ghost-bordeaux";
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
                <Button
                  key={opt.value}
                  variant={variant}
                  size="sm"
                  active={isActive}
                  onClick={() => onChange(group.key, opt.value)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
      {onReset && (
        <Button
          variant={variant}
          size="sm"
          className="filter-panel__reset"
          onClick={onReset}
        >
          {t("filter.reset")}
        </Button>
      )}
    </div>
  );
}
