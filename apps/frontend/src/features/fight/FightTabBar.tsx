import "./FightTabBar.css";
import type { Tab } from "./fight.types";
import DeckWidget from "../deck/DeckWidget";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedDeck: number | null;
  onSelectDeck: (id: number | null) => void;
}

export default function FightTabBar({ tab, onTabChange, selectedDeck, onSelectDeck }: Props) {
  return (
    <div className="ftb-bar">
      {(["fight", "history", "leaderboard"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => onTabChange(t)}
          className={`ftb-tab${tab === t ? " ftb-tab--active" : ""}`}
        >
          {{ fight: "⚔️ Combat", history: "📜 Historique", leaderboard: "🏆 Classement" }[t]}
        </button>
      ))}
      <div className="ftb-spacer" />
      <DeckWidget onSelectDeck={onSelectDeck} selectedDeckId={selectedDeck ?? undefined} />
    </div>
  );
}
