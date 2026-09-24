import { useCallback, useMemo, useState } from "react";
import type {
  FilterGroupConfig,
  FilterValues,
} from "../components/FilterPanel";

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
