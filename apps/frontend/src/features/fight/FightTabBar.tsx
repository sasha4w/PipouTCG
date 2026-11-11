import { useTranslation } from "react-i18next";
import "./FightTabBar.css";
import type { Tab } from "./fight.types";
import DeckWidget from "../deck/DeckWidget";
import type { ReactNode } from "react";
import {
  IconInfo,
  IconScroll,
  IconSwords,
  IconTrophy,
} from "../../components/Icons";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedDeck: number | null;
  onSelectDeck: (id: number | null) => void;
}

const TAB_ICONS: Record<Tab, (props: { size?: number }) => ReactNode> = {
  fight: IconSwords,
  history: IconScroll,
  leaderboard: IconTrophy,
  rules: IconInfo,
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
        {(["fight", "history", "leaderboard", "rules"] as Tab[]).map((id) => {
          const Icon = TAB_ICONS[id];
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`ftb-tab${tab === id ? " ftb-tab--active" : ""}`}
            >
              <span className="ftb-tab-icon">
                <Icon size={18} />
              </span>
              <span className="ftb-tab-label">{t(`fight.tabs.${id}`)}</span>
            </button>
          );
        })}
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
