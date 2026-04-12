import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
// Import des nouveaux hooks et des clés
import { useQuests, useClaimReward } from "../../hooks/useGameData";
import { QUERY_KEYS } from "../../utils/querykeys";
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

// ── Reward label ──────────────────────────────────────────────────────────────
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
function formatTimeRemaining(
  resetAt: string | null,
  t: (k: string, opts?: any) => string,
): string {
  if (!resetAt) return t("quests.permanent");
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return t("quests.expired");
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return t("quests.remaining_days", { d, h });
  if (h > 0) return t("quests.remaining_hours", { h, m });
  if (m > 0) return t("quests.remaining_mins", { m, s });
  return t("quests.remaining_secs", { s });
}

function useCountdown(
  resetAt: string | null,
  t: (k: string, opts?: any) => string,
): string {
  const [label, setLabel] = useState(() => formatTimeRemaining(resetAt, t));
  useEffect(() => {
    if (!resetAt) return;
    setLabel(formatTimeRemaining(resetAt, t));
    const interval = setInterval(
      () => setLabel(formatTimeRemaining(resetAt, t)),
      1000,
    );
    return () => clearInterval(interval);
  }, [resetAt, t]);
  return label;
}

// ── Progress ──────────────────────────────────────────────────────────────────
function parseProgress(quest: UserQuest): { current: number; target: number } {
  try {
    const conds = quest.progress?.conditions ?? [];
    if (conds.length === 0) return { current: 0, target: 1 };
    return {
      current: conds.reduce((s: number, c: any) => s + (c.current ?? 0), 0),
      target: conds.reduce((s: number, c: any) => s + (c.target ?? 1), 0),
    };
  } catch {
    return { current: 0, target: 1 };
  }
}

// ── QuestItem ─────────────────────────────────────────────────────────────────
function QuestItem({
  quest,
  onClaim,
  claiming,
}: {
  quest: UserQuest;
  onClaim: (id: number) => void;
  claiming: number | null;
}) {
  const { t } = useTranslation();
  const { current, target } = parseProgress(quest);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const done = quest.isCompleted;
  const canClaim = done && !quest.rewardClaimed;
  const timeLeft = useCountdown(quest.resetAt, t);

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
          disabled={claiming !== null} // On bloque si n'importe quel claim est en cours
        >
          {claiming === quest.id ? "..." : t("quests.claim")}
        </button>
      )}
      {done && quest.rewardClaimed && (
        <span className="quest-item__claimed">
          <IconCheck size={12} color="rgba(255,255,255,0.35)" />{" "}
          {t("quests.claimed")}
        </span>
      )}
    </div>
  );
}

export default function QuestsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // 1. On récupère les données via le Hook (plus de props !)
  const { data: quests, isLoading } = useQuests();
  const claimMutation = useClaimReward();

  const [activeTab, setActiveTab] = useState<keyof UserQuestsGrouped>("DAILY");
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const TABS: { key: keyof UserQuestsGrouped; labelKey: string }[] = [
    { key: "DAILY", labelKey: "quests.daily" },
    { key: "WEEKLY", labelKey: "quests.weekly" },
    { key: "MONTHLY", labelKey: "quests.monthly" },
    { key: "ACHIEVEMENT", labelKey: "quests.achievement" },
    { key: "EVENT", labelKey: "quests.event" },
  ];

  if (isLoading || !quests)
    return <div className="quests-panel__loading">Chargement...</div>;

  // On filtre les onglets qui ont des quêtes
  const visibleTabs = TABS.filter((tab) => quests[tab.key].length > 0);
  const currentList = quests[activeTab] ?? [];

  // 2. Gestion du "Claim All"
  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      await questService.claimAllRewards();
      // On rafraîchit tout
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    } finally {
      setIsClaimingAll(false);
    }
  };

  const claimableInTab = currentList.filter(
    (q) => q.isCompleted && !q.rewardClaimed,
  );

  return (
    <div className="quests-panel">
      <div className="quests-panel__header">
        <h2 className="quests-panel__title">{t("quests.title")}</h2>
      </div>

      {/* FIX : On ré-intègre les onglets pour utiliser visibleTabs, setActiveTab et IconBell */}
      <div className="quests-panel__tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`quests-panel__tab${activeTab === tab.key ? " quests-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
            {/* On affiche la cloche si une quête est prête dans cet onglet */}
            {quests[tab.key].some((q) => q.isCompleted && !q.rewardClaimed) && (
              <IconBell size={11} color="#eebc77" style={{ marginLeft: 5 }} />
            )}
          </button>
        ))}
      </div>

      <div className="quests-panel__list-actions">
        {claimableInTab.length > 1 && (
          <button
            className="quests-panel__claim-all"
            onClick={handleClaimAll}
            disabled={isClaimingAll || claimMutation.isPending}
          >
            {isClaimingAll
              ? "..."
              : `${t("quests.claim_all")} (${claimableInTab.length})`}
          </button>
        )}
      </div>

      <div className="quests-panel__list">
        {currentList.length === 0 ? (
          <p className="quests-panel__empty">{t("quests.empty")}</p>
        ) : (
          currentList.map((quest) => (
            <QuestItem
              key={quest.id}
              quest={quest}
              onClaim={(id) => claimMutation.mutate(id)} // Utilise la mutation optimiste
              claiming={
                claimMutation.isPending
                  ? (claimMutation.variables as number)
                  : null
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
