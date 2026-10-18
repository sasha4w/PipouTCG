import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { isAchievementClaimable, type QuestListKey, type UserQuest } from "@pipou/shared";
import {
  useAchievements,
  useClaimReward,
  useQuests,
  useRerollQuest,
} from "../../hooks/useGameData";
import { QUERY_KEYS } from "../../utils/querykeys";
import { questService } from "../../services/quest.service";
import { IconBell, IconCheck, IconUndo } from "../../components/Icons";
import Button from "../../components/Button";
import RewardLabel from "../quests/RewardLabel";
import { useCountdown } from "../quests/useCountdown";
import { questTitle } from "../quests/questTitle";
import AchievementsTab from "../achievements/AchievementsTab";
import "./QuestsPanel.css";

type TabKey = QuestListKey | "ACHIEVEMENTS";

const QUEST_TABS: { key: QuestListKey; labelKey: string; always: boolean }[] = [
  { key: "DAILY", labelKey: "quests.daily", always: true },
  { key: "WEEKLY", labelKey: "quests.weekly", always: true },
  { key: "MONTHLY", labelKey: "quests.monthly", always: false },
  { key: "EVENT", labelKey: "quests.event", always: false },
];

function parseProgress(quest: UserQuest): { current: number; target: number } {
  const conds = quest.progress?.conditions ?? [];
  if (conds.length === 0) return { current: 0, target: 1 };
  return {
    current: conds.reduce((s, c) => s + (c.current ?? 0), 0),
    target: conds.reduce((s, c) => s + (c.target ?? 1), 0),
  };
}

interface QuestItemProps {
  quest: UserQuest;
  busy: boolean;
  claiming: boolean;
  canReroll: boolean;
  onClaim: () => void;
  onReroll: () => void;
}

function QuestItem({ quest, busy, claiming, canReroll, onClaim, onReroll }: QuestItemProps) {
  const { t } = useTranslation();
  const { current, target } = parseProgress(quest);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const done = quest.isCompleted;

  return (
    <div className={`quest-item${done ? " quest-item--completed" : ""}`}>
      <div className="quest-item__top">
        <span className="quest-item__title">{questTitle(quest.title)}</span>
        <RewardLabel type={quest.rewardType} amount={quest.rewardAmount} />
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
        {canReroll && !done && (
          <button
            type="button"
            className="quest-item__reroll"
            onClick={onReroll}
            disabled={busy}
            aria-label={t("quests.reroll")}
            title={t("quests.reroll_hint")}
          >
            <IconUndo size={14} color="currentColor" />
          </button>
        )}
      </div>
      {done && !quest.rewardClaimed && (
        <Button
          variant="primary-inverse"
          size="sm"
          className="quest-item__claim-btn"
          onClick={onClaim}
          disabled={busy}
        >
          {claiming ? "..." : t("quests.claim")}
        </Button>
      )}
      {done && quest.rewardClaimed && (
        <span className="quest-item__claimed">
          <IconCheck size={12} color="rgba(255,255,255,0.35)" /> {t("quests.claimed")}
        </span>
      )}
    </div>
  );
}

export default function QuestsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: quests, isLoading } = useQuests();
  const { data: achievements } = useAchievements();
  const claimMutation = useClaimReward();
  const rerollMutation = useRerollQuest();
  const [activeTab, setActiveTab] = useState<TabKey>("DAILY");
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const resetAt =
    activeTab === "DAILY"
      ? (quests?.dailyResetAt ?? null)
      : activeTab === "WEEKLY"
        ? (quests?.weeklyResetAt ?? null)
        : null;
  const countdown = useCountdown(resetAt, t, () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests }),
  );

  if (isLoading || !quests)
    return <div className="quests-panel__loading">{t("quests.loading")}</div>;

  const visibleTabs = QUEST_TABS.filter((tab) => tab.always || quests[tab.key].length > 0);
  const currentList = activeTab === "ACHIEVEMENTS" ? [] : quests[activeTab];
  const claimable = currentList.filter((q) => q.isCompleted && !q.rewardClaimed);
  const busy = claimMutation.isPending || rerollMutation.isPending || isClaimingAll;

  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      await questService.claimAllRewards();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <div className="quests-panel">
      <div className="quests-panel__header">
        <h2 className="quests-panel__title">{t("quests.title")}</h2>
        {resetAt && !countdown.expired && (
          <span className="quests-panel__reset">
            {t("quests.reset_in", { time: countdown.label })}
          </span>
        )}
      </div>

      <div className="quests-panel__tabs">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.key}
            variant="ghost-gold"
            size="sm"
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
            {quests[tab.key].some((q) => q.isCompleted && !q.rewardClaimed) && (
              <IconBell size={11} color="#eebc77" style={{ marginLeft: 5 }} />
            )}
          </Button>
        ))}
        <Button
          variant="ghost-gold"
          size="sm"
          active={activeTab === "ACHIEVEMENTS"}
          onClick={() => setActiveTab("ACHIEVEMENTS")}
        >
          {t("achievements.tab")}
          {achievements && ` ${achievements.unlocked}/${achievements.total}`}
          {achievements?.families.some(isAchievementClaimable) && (
            <IconBell size={11} color="#eebc77" style={{ marginLeft: 5 }} />
          )}
        </Button>
      </div>

      {activeTab === "ACHIEVEMENTS" ? (
        <AchievementsTab />
      ) : (
        <>
          {claimable.length > 1 && (
            <div className="quests-panel__list-actions">
              <Button variant="primary-inverse" size="sm" onClick={handleClaimAll} disabled={busy}>
                {isClaimingAll ? "..." : `${t("quests.claim_all")} (${claimable.length})`}
              </Button>
            </div>
          )}
          <div className="quests-panel__list">
            {currentList.length === 0 ? (
              <p className="quests-panel__empty">{t("quests.empty")}</p>
            ) : (
              currentList.map((quest) => (
                <QuestItem
                  key={quest.id}
                  quest={quest}
                  busy={busy}
                  claiming={claimMutation.isPending && claimMutation.variables === quest.id}
                  canReroll={quests.rerollAvailable && (activeTab === "DAILY" || activeTab === "WEEKLY")}
                  onClaim={() => claimMutation.mutate(quest.id)}
                  onReroll={() => rerollMutation.mutate(quest.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
