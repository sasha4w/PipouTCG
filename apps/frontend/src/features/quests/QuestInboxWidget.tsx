import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuests, useClaimReward } from "../../hooks/useGameData";
import { questService } from "../../services/quest.service";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  IconGold,
  IconBooster,
  IconBundle,
  IconTrophy,
} from "../../components/Icons";
import "./QuestInboxWidget.css";

const RESET_TYPE_LABEL: Record<string, string> = {
  DAILY: "Quotidienne",
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  EVENT: "Événement",
  NONE: "Permanent",
};

function RewardIcon({ type }: { type: string }) {
  const p = { size: 12, color: "#eebc77" };
  if (type === "GOLD") return <IconGold {...p} />;
  if (type === "BOOSTER") return <IconBooster {...p} />;
  if (type === "BUNDLE") return <IconBundle {...p} />;
  return null;
}

export default function QuestInboxWidget({
  onOpenPanel,
}: {
  onOpenPanel?: () => void;
}) {
  const { t } = useTranslation();
  const { data: quests } = useQuests();
  const claimMutation = useClaimReward();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allQuests = quests
    ? [
        ...quests.DAILY,
        ...quests.WEEKLY,
        ...quests.MONTHLY,
        ...quests.ACHIEVEMENT,
        ...quests.EVENT,
      ]
    : [];
  const claimable = allQuests.filter((q) => q.isCompleted && !q.rewardClaimed);

  const handleClaimAll = async () => {
    setClaimingAll(true);
    try {
      await questService.claimAllRewards();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    } finally {
      setClaimingAll(false);
    }
  };

  return (
    <div className="qi" ref={ref}>
      <button
        className="qi__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("quests.inbox_label")}
      >
        <IconTrophy size={17} color="#7a1c3b" />
        {claimable.length > 0 && (
          <span className="qi__badge">{claimable.length}</span>
        )}
      </button>

      {open && (
        <div className="qi__dropdown">
          <div className="qi__dheader">
            <span className="qi__dheader-title">{t("quests.inbox_title")}</span>
            {claimable.length > 1 && (
              <button
                className="qi__claim-all"
                onClick={handleClaimAll}
                disabled={claimingAll || claimMutation.isPending}
              >
                {claimingAll
                  ? "..."
                  : `${t("quests.claim_all")} (${claimable.length})`}
              </button>
            )}
          </div>

          <div className="qi__list">
            {claimable.length === 0 ? (
              <p className="qi__empty">{t("quests.nothing_to_claim")}</p>
            ) : (
              claimable.map((quest) => (
                <div key={quest.id} className="qi__item">
                  <div className="qi__item-row">
                    <span className="qi__item-title">{quest.title}</span>
                    <span className="qi__item-reward">
                      <RewardIcon type={quest.rewardType} />+
                      {quest.rewardAmount}
                    </span>
                  </div>
                  <div className="qi__item-footer">
                    {/* ← MODIFIÉ ICI */}
                    <span className="qi__item-type">
                      {RESET_TYPE_LABEL[quest.resetType] ?? quest.resetType}
                    </span>
                    <button
                      className="qi__item-claim"
                      onClick={() => claimMutation.mutate(quest.id)}
                      disabled={claimMutation.isPending}
                    >
                      {claimMutation.isPending &&
                      claimMutation.variables === quest.id
                        ? "..."
                        : t("quests.claim")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {onOpenPanel && (
            <div className="qi__footer">
              <button
                className="qi__footer-link"
                onClick={() => {
                  setOpen(false);
                  onOpenPanel();
                }}
              >
                {t("quests.see_all")} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
