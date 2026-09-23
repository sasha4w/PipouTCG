import { useTranslation } from "react-i18next";
import type { UserProfile } from "../../services/user.service";
import "./StatsPanel.css";

interface StatsPanelProps {
  stats: UserProfile["stats"];
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const { t } = useTranslation();

  const STAT_ITEMS = [
    { key: "boostersOpened" as const, label: t("stats.boosters_opened") },
    { key: "cardsBought" as const, label: t("stats.cards_bought") },
    { key: "cardsSold" as const, label: t("stats.cards_sold") },
    { key: "boostersBought" as const, label: t("stats.boosters_bought") },
    { key: "bundlesBought" as const, label: t("stats.bundles_bought") },
    { key: "boostersSold" as const, label: t("stats.boosters_sold") },
    { key: "bundlesSold" as const, label: t("stats.bundles_sold") },
    { key: "moneyEarned" as const, label: t("stats.money_earned") },
    { key: "moneySpent" as const, label: t("stats.money_spent") },
    { key: "setsCompleted" as const, label: t("stats.sets_completed") },
  ];
  return (
    <div className="stats-panel">
      <h2 className="stats-panel__title">{t("stats.title")}</h2>
      <div className="stats-panel__grid">
        {STAT_ITEMS.map((item) => (
          <div key={item.key} className="stats-panel__card">
            <span className="stats-panel__card-label">{item.label}</span>
            <span className="stats-panel__card-value">
              {typeof stats[item.key] === "number"
                ? stats[item.key].toLocaleString()
                : stats[item.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
