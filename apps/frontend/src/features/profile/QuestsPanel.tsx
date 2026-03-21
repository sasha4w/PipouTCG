import { useState, useEffect } from "react";
import { questService } from "../../services/quest.service";
import type {
  UserQuest,
  UserQuestsGrouped,
} from "../../services/quest.service";
import {
  IconGold,
  IconBooster,
  IconBundle,
  IconBell,
  IconCheck,
} from "../../components/Icons";
import "./QuestsPanel.css";

// ── Onglets ───────────────────────────────────────────────────────────────────
const TABS: { key: keyof UserQuestsGrouped; label: string }[] = [
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "ACHIEVEMENT", label: "Achievements" },
  { key: "EVENT", label: "Événements" },
];

// ── Reward label (JSX) ────────────────────────────────────────────────────────
function RewardLabel({ quest }: { quest: UserQuest }) {
  const amount = quest.rewardAmount;
  const iconProps = { size: 13, color: "#eebc77" };

  switch (quest.rewardType) {
    case "GOLD":
      return (
        <span className="quest-item__reward">
          <IconGold {...iconProps} /> +{amount}
        </span>
      );
    case "BOOSTER":
      return (
        <span className="quest-item__reward">
          <IconBooster {...iconProps} /> +{amount}
        </span>
      );
    case "BUNDLE":
      return (
        <span className="quest-item__reward">
          <IconBundle {...iconProps} /> +{amount}
        </span>
      );
    default:
      return <span className="quest-item__reward">+{amount}</span>;
  }
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function formatTimeRemaining(resetAt: string | null): string {
  if (!resetAt) return "Permanent";
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}j ${hours}h restantes`;
  if (hours > 0) return `${hours}h ${mins}min restantes`;
  if (mins > 0) return `${mins}min ${secs}s restantes`;
  return `${secs}s restantes`;
}

function useCountdown(resetAt: string | null): string {
  const [label, setLabel] = useState(() => formatTimeRemaining(resetAt));
  useEffect(() => {
    if (!resetAt) return;
    setLabel(formatTimeRemaining(resetAt));
    const interval = setInterval(
      () => setLabel(formatTimeRemaining(resetAt)),
      1000,
    );
    return () => clearInterval(interval);
  }, [resetAt]);
  return label;
}

// ── Progress parser ───────────────────────────────────────────────────────────
function parseProgress(quest: UserQuest): { current: number; target: number } {
  try {
    const conds = quest.progress?.conditions ?? [];
    if (conds.length === 0) return { current: 0, target: 1 };
    const current = conds.reduce(
      (s: number, c: any) => s + (c.current ?? 0),
      0,
    );
    const target = conds.reduce((s: number, c: any) => s + (c.target ?? 1), 0);
    return { current, target };
  } catch {
    return { current: 0, target: 1 };
  }
}

// ── QuestItem ─────────────────────────────────────────────────────────────────
interface QuestItemProps {
  quest: UserQuest;
  onClaim: (id: number) => void;
  claiming: number | null;
}

function QuestItem({ quest, onClaim, claiming }: QuestItemProps) {
  const { current, target } = parseProgress(quest);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const done = quest.isCompleted;
  const canClaim = done && !quest.rewardClaimed;
  const timeLeft = useCountdown(quest.resetAt);

  return (
    <div className={`quest-item${done ? " quest-item--completed" : ""}`}>
      <div className="quest-item__top">
        <span className="quest-item__title">{quest.title}</span>
        <RewardLabel quest={quest} />
      </div>

      <div className="quest-item__progress">
        <div className="quest-item__bar">
          <div
            className={`quest-item__bar-fill${done ? " quest-item__bar-fill--done" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="quest-item__progress-text">
          {current}/{target}
        </span>
      </div>

      <span className="quest-item__timer">{timeLeft}</span>

      {canClaim && (
        <button
          className="quest-item__claim-btn"
          onClick={() => onClaim(quest.id)}
          disabled={claiming === quest.id}
        >
          {claiming === quest.id ? "..." : "Réclamer"}
        </button>
      )}
      {done && quest.rewardClaimed && (
        <span className="quest-item__claimed">
          <IconCheck size={12} color="rgba(255,255,255,0.35)" /> Réclamé
        </span>
      )}
    </div>
  );
}

// ── QuestsPanel ───────────────────────────────────────────────────────────────
interface QuestsPanelProps {
  quests: UserQuestsGrouped;
  onQuestsUpdate: (quests: UserQuestsGrouped) => void;
}

export default function QuestsPanel({
  quests,
  onQuestsUpdate,
}: QuestsPanelProps) {
  const [activeTab, setActiveTab] = useState<keyof UserQuestsGrouped>("DAILY");
  const [claiming, setClaiming] = useState<number | null>(null);

  const visibleTabs = TABS.filter((t) => quests[t.key].length > 0);
  const currentList = quests[activeTab] ?? [];

  const handleClaim = async (userQuestId: number) => {
    setClaiming(userQuestId);
    try {
      await questService.claimReward(userQuestId);
      const updated = await questService.getMyQuests();
      onQuestsUpdate(updated);
    } catch (e) {
      console.error("Claim failed", e);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="quests-panel">
      <div className="quests-panel__header">
        <h2 className="quests-panel__title">Missions</h2>
      </div>

      <div className="quests-panel__tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`quests-panel__tab${activeTab === t.key ? " quests-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {quests[t.key].some((q) => q.isCompleted && !q.rewardClaimed) && (
              <IconBell size={11} color="#eebc77" />
            )}
          </button>
        ))}
      </div>

      <div className="quests-panel__list">
        {currentList.length === 0 ? (
          <p className="quests-panel__empty">
            Aucune mission dans cette catégorie.
          </p>
        ) : (
          currentList.map((quest) => (
            <QuestItem
              key={quest.id}
              quest={quest}
              onClaim={handleClaim}
              claiming={claiming}
            />
          ))
        )}
      </div>
    </div>
  );
}
