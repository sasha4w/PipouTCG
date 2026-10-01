import type { TFunction } from "i18next";
import { CardType, Rarity } from "@pipou/shared";
import type {
  FilterGroupConfig,
  FilterValues,
} from "../../components/FilterPanel";

/** Clés des groupes de filtres carte (partagées entre collection et marché). */
export const CARD_FILTER_KEYS = { type: "cardType", rarity: "rarity" } as const;

/** Groupes « type de carte » et « rareté », générés depuis les enums partagés. */
export function cardFilterGroups(t: TFunction): FilterGroupConfig[] {
  return [
    {
      key: CARD_FILTER_KEYS.type,
      label: t("filter.type"),
      options: [
        { value: "all", label: t("filter.all") },
        ...Object.values(CardType).map((type) => ({
          value: type,
          label: t(`filter.${type}`),
        })),
      ],
    },
    {
      key: CARD_FILTER_KEYS.rarity,
      label: t("filter.rarity"),
      options: [
        { value: "all", label: t("filter.all_rarities") },
        ...Object.values(Rarity).map((rarity) => ({
          value: rarity,
          label: t(`rarity.${rarity}`),
        })),
      ],
    },
  ];
}

/** Vrai si un filtre carte (type ou rareté) est actif. */
export function hasActiveCardFilter(values: FilterValues): boolean {
  return (
    (values[CARD_FILTER_KEYS.type] ?? "all") !== "all" ||
    (values[CARD_FILTER_KEYS.rarity] ?? "all") !== "all"
  );
}

/** La carte passe-t-elle les filtres type / rareté ? */
export function matchesCardFilters(
  values: FilterValues,
  card: { type?: string | null; rarity?: string | null },
): boolean {
  const type = values[CARD_FILTER_KEYS.type] ?? "all";
  const rarity = values[CARD_FILTER_KEYS.rarity] ?? "all";
  if (type !== "all" && card.type?.toLowerCase() !== type) return false;
  if (rarity !== "all" && card.rarity?.toLowerCase() !== rarity) return false;
  return true;
}
