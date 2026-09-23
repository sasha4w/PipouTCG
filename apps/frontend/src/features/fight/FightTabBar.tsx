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

const TAB_LABELS: Record<Tab, string> = {
  fight: "Combat",
  history: "Historique",
  leaderboard: "Classement",
  rules: "Règles",
};

export default function FightTabBar({
  tab,
  onTabChange,
  selectedDeck,
  onSelectDeck,
}: Props) {
  return (
    <>
      <div className="ftb-bar">
        {(["fight", "history", "leaderboard", "rules"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`ftb-tab${tab === t ? " ftb-tab--active" : ""}`}
          >
            <span className="ftb-tab-icon">{TAB_ICONS[t]}</span>
            <span className="ftb-tab-label">{TAB_LABELS[t]}</span>
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
