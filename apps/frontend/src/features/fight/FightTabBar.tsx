import { useTranslation } from "react-i18next";
import "./FightTabBar.css";
import type { Tab } from "./fight.types";
import DeckWidget from "../deck/DeckWidget";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedDeck: number | null;
  onSelectDeck: (id: number | null) => void;
}

const TAB_ICONS: Record<Tab, string> = {
  fight: "⚔️",
  history: "📜",
  leaderboard: "🏆",
  rules: "📖",
};

export default function FightTabBar({
  tab,
  onTabChange,
  selectedDeck,
  onSelectDeck,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ftb-bar">
        {(["fight", "history", "leaderboard", "rules"] as Tab[]).map((id) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`ftb-tab${tab === id ? " ftb-tab--active" : ""}`}
          >
            <span className="ftb-tab-icon">{TAB_ICONS[id]}</span>
            <span className="ftb-tab-label">{t(`fight.tabs.${id}`)}</span>
          </button>
        ))}
      </div>

      {tab === "fight" && (
        <div className="ftb-deck-row">
          <DeckWidget
            onSelectDeck={onSelectDeck}
            selectedDeckId={selectedDeck ?? undefined}
          />
        </div>
      )}
    </>
  );
}
