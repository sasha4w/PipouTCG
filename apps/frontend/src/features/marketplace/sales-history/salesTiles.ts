import type { SalesStats } from "@pipou/shared";
import type { TFunction } from "i18next";
import type { StatTileData } from "./StatTiles";
import { formatGold, type SalesPlayer, type SalesScope } from "./salesScope";

const shortDate = (iso: string, lng: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(lng, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });

/** Vue compacte : ventes, or total, prix moyen par unité, plus grosse vente. */
export function compactTiles(
  stats: SalesStats,
  t: TFunction,
  lng: string,
  onBiggestClick: (saleId: number) => void,
): StatTileData[] {
  const big = stats.biggestSale;
  return [
    { key: "count", label: t("marketplace.sales.tile_count"), value: stats.count },
    { key: "total", label: t("marketplace.sales.tile_total"), value: stats.totalGold, unit: " G" },
    { key: "avg", label: t("marketplace.sales.tile_avg"), value: stats.avgUnitPrice, unit: " G" },
    {
      key: "biggest",
      label: t("marketplace.sales.tile_biggest"),
      value: big?.totalPrice ?? null,
      unit: " G",
      caption: big ? `${big.itemName} · ${shortDate(big.date, lng)}` : undefined,
      onClick: big ? () => onBiggestClick(big.id) : undefined,
    },
  ];
}

/** Panneau « Détails » : les 6 autres stats (partenaire seulement pour un joueur). */
export function detailTiles(
  stats: SalesStats,
  scope: SalesScope,
  t: TFunction,
  lng: string,
  onPartnerClick: (player: SalesPlayer) => void,
): StatTileData[] {
  const { topItem, topPartner, bestDay, trend } = stats;
  const tiles: StatTileData[] = [
    {
      key: "top-item",
      label: t("marketplace.sales.tile_top_item"),
      value: null,
      text: topItem?.itemName,
      caption: topItem ? t("marketplace.sales.units_suffix", { count: topItem.units }) : undefined,
    },
  ];
  if (scope.kind === "player") {
    tiles.push({
      key: "partner",
      label: t("marketplace.sales.tile_partner"),
      value: null,
      text: topPartner?.username,
      caption: topPartner
        ? t("marketplace.sales.partner_count", { count: topPartner.count })
        : undefined,
      onClick: topPartner
        ? () => onPartnerClick({ id: topPartner.userId, username: topPartner.username })
        : undefined,
    });
  }
  tiles.push(
    {
      key: "best-day",
      label: t("marketplace.sales.tile_best_day"),
      value: bestDay?.gold ?? null,
      unit: " G",
      caption: bestDay ? shortDate(bestDay.date, lng) : undefined,
    },
    {
      key: "range",
      label: t("marketplace.sales.tile_range"),
      value: null,
      text:
        stats.minUnitPrice !== null && stats.maxUnitPrice !== null
          ? `${stats.minUnitPrice}–${formatGold(stats.maxUnitPrice)}`
          : undefined,
    },
    { key: "units", label: t("marketplace.sales.tile_units"), value: stats.unitsTraded },
    {
      key: "trend",
      label: t("marketplace.sales.tile_trend"),
      value: null,
      text:
        trend.percent === null
          ? undefined
          : `${trend.percent > 0 ? "+" : ""}${trend.percent} %`,
      tone:
        trend.percent === null || trend.percent === 0
          ? undefined
          : trend.percent > 0
            ? "up"
            : "down",
      caption: formatGold(trend.last7),
    },
  );
  return tiles;
}
