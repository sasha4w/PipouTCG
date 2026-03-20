import type { UserProfile } from "../services/user.service";
import "./StatsPanel.css";

interface StatsPanelProps {
  stats: UserProfile["stats"];
}

const STAT_ITEMS = [
  { key: "boostersOpened", label: "Boosters ouverts" },
  { key: "cardsBought", label: "Cartes achetées" },
  { key: "cardsSold", label: "Cartes vendues" },
  { key: "moneyEarned", label: "Gold gagné" },
  { key: "setsCompleted", label: "Sets complétés" },
] as const;

export default function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="stats-panel">
      <h2 className="stats-panel__title">Statistiques</h2>
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
