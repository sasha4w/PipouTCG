/* eslint-disable react-refresh/only-export-components -- helpers purs exportés pour les tests/le widget */
import type { DailyRewardItem, DailyRewardType } from "@pipou/shared";
import { IconBooster, IconBundle, IconCards, IconGold } from "../Icons";

export const MONTH_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const REWARD_LABEL: Record<DailyRewardType, string> = {
  gold: "Gold",
  card: "Carte",
  booster: "Booster",
  bundle: "Bundle",
};

/** Jour courant YYYY-MM-DD en UTC (même découpage que le serveur). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** « 150 gold », « 2× Booster »… */
export function rewardText(
  r: Pick<DailyRewardItem, "type" | "value" | "quantity">,
): string {
  return r.type === "gold"
    ? `${r.value * r.quantity} gold`
    : `${r.quantity}× ${REWARD_LABEL[r.type]}`;
}

export function RewardIcon({
  type,
  size = 24,
}: {
  type: DailyRewardType;
  size?: number;
}) {
  switch (type) {
    case "gold":
      return <IconGold size={size} color="#c8960c" />;
    case "card":
      return <IconCards size={size} color="#eebc77" />;
    case "booster":
      return <IconBooster size={size} color="#eebc77" />;
    case "bundle":
      return <IconBundle size={size} color="#eebc77" />;
  }
}
