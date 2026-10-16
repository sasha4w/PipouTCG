import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stripEmoji,
  type ClaimDailyResult,
  type ClaimedDailyResult,
  type DailyRewardGain,
} from "@pipou/shared";
import { dailyRewardService } from "../services/dailyReward.service";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import type { ToastType } from "../hooks/useToast";
import { apiErrorMessage } from "../utils/errors";
import Button from "./Button";
import MonthCalendar from "./daily-reward/MonthCalendar";
import MilestoneCard from "./daily-reward/MilestoneCard";
import { MONTH_FR, RewardIcon, rewardText, todayUtc } from "./daily-reward/rewardDisplay";
import {
  IconCalendar,
  IconCheck,
  IconClose,
  IconFire,
  IconGold,
  IconPartyHorn,
  IconSkull,
  IconTrophy,
} from "./Icons";
import "./DailyRewardModal.css";

type Phase = "idle" | "claiming" | "rescue" | "result";

interface DailyRewardModalProps {
  onClose: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function RewardList({ rewards }: { rewards: DailyRewardGain[] }) {
  return (
    <div className="drm-rewards">
      {rewards.map((r, i) => (
        <motion.div
          key={i}
          className={`drm-reward ${r.isMilestone ? "drm-reward--milestone" : ""}`}
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.15, type: "spring", damping: 14 }}
        >
          <RewardIcon type={r.type} size={28} />
          <span className="drm-reward__qty">
            {r.type === "gold" ? `+${r.value * r.quantity}` : `×${r.quantity}`}
          </span>
          <span className="drm-reward__type">
            {stripEmoji(r.label) ?? rewardText(r)}
          </span>
          {r.isMilestone && (
            <span className="drm-reward__badge">
              <IconTrophy size={10} color="#eebc77" /> Palier
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function DailyRewardModal({ onClose, addToast }: DailyRewardModalProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [claimResult, setClaimResult] = useState<ClaimedDailyResult | null>(null);
  const [rescue, setRescue] = useState<{ cost: number; streak: number } | null>(null);
  const [error, setError] = useState("");

  const { data: status } = useQuery({
    queryKey: QUERY_KEYS.dailyRewardStatus,
    queryFn: () => dailyRewardService.getStatus(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });

  const today = todayUtc();
  const monthTitle = `${MONTH_FR[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`;
  const missingGold =
    rescue && me ? Math.max(rescue.cost - Number(me.gold), 0) : 0;

  const showResult = (result: ClaimDailyResult, streakLost?: number) => {
    if (result.status === "rescue_required") {
      setRescue({ cost: result.rescue.cost, streak: result.streak.current });
      setPhase("rescue");
      return;
    }
    setClaimResult(streakLost ? { ...result, streakLost } : result);
    refreshQueries();
    setPhase("result");
  };

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyRewardStatus });
  };

  // `settle` lets the action move the fallback phase once the streak state has changed server-side.
  const run = async (
    action: (settle: (phase: Phase) => void) => Promise<void>,
    fallback: string,
    initialErrorPhase: Phase,
  ) => {
    let errorPhase = initialErrorPhase;
    setPhase("claiming");
    setError("");
    try {
      await action((phase) => {
        errorPhase = phase;
      });
    } catch (e) {
      setError(apiErrorMessage(e) ?? fallback);
      setPhase(errorPhase);
    }
  };

  const handleClaim = () =>
    run(async () => showResult(await dailyRewardService.claimDaily()), "Erreur lors du claim.", "idle");

  const handleRescue = () =>
    run(
      async (settle) => {
        const res = await dailyRewardService.rescueStreak();
        refreshQueries();
        settle("idle");
        addToast(`Série sauvée ! ${res.goldSpent} gold dépensés.`, "success");
        showResult(await dailyRewardService.claimDaily());
      },
      "Erreur lors du rachat.",
      "rescue",
    );

  const handleRestart = () =>
    run(
      async (settle) => {
        await dailyRewardService.resetStreak();
        refreshQueries();
        settle("idle");
        showResult(await dailyRewardService.claimDaily(), rescue?.streak);
      },
      "Erreur lors de la réinitialisation.",
      "rescue",
    );

  return (
    <div
      className="drm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "claiming") onClose();
      }}
    >
      <motion.div
        className="drm-modal"
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
      >
        {phase !== "claiming" && (
          <Button variant="ghost-gold" size="icon" aria-label="Fermer" className="drm-close" onClick={onClose}>
            <IconClose size={16} />
          </Button>
        )}

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="idle" className="drm-content" {...fade}>
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconCalendar size={22} color="#eebc77" />
                  <h2 className="drm-header__title">{monthTitle}</h2>
                </div>
                {status && (
                  <div className="drm-header__stats">
                    <span className="drm-stat">
                      <IconFire size={12} color="#e05a00" />
                      <strong>{status.streak.current}</strong> consécutifs
                    </span>
                    <span className="drm-stat-sep">·</span>
                    <span className="drm-stat">
                      <strong>{status.streak.totalDays}</strong> au total
                    </span>
                    <span className="drm-stat-sep">·</span>
                    <span className="drm-stat">
                      record <strong>{status.streak.longest}</strong> j
                    </span>
                  </div>
                )}
              </div>

              {status && (
                <MonthCalendar
                  today={today}
                  claimedDates={status.claimedDates}
                  rescuedDates={status.rescuedDates}
                />
              )}

              {status?.nextReward && (
                <div className="drm-today">
                  <span className="drm-today__icon">
                    <RewardIcon type={status.nextReward.type} size={24} />
                  </span>
                  <div className="drm-today__body">
                    <span className="drm-today__meta">
                      {status.alreadyClaimed ? "Demain" : "Aujourd'hui"} · Semaine {status.nextDay.weekNumber} · Jour {status.nextDay.cycleDay}
                    </span>
                    <strong className="drm-today__value">{rewardText(status.nextReward)}</strong>
                    {stripEmoji(status.nextReward.label) && (
                      <span className="drm-today__label">{stripEmoji(status.nextReward.label)}</span>
                    )}
                  </div>
                </div>
              )}

              {status && <MilestoneCard milestones={status.milestones} streak={status.streakAtRisk ? 0 : status.streak.current} />}

              {status?.streakAtRisk && (
                <p className="drm-warning">
                  <IconSkull size={14} color="#f27aaa" />
                  Ta série de {status.streak.current} jours sera perdue en réclamant.
                </p>
              )}

              {error && <p className="drm-error">{error}</p>}

              <Button variant="primary-inverse" size="lg" fullWidth onClick={handleClaim} disabled={status?.alreadyClaimed}>
                {status?.alreadyClaimed ? (
                  <>
                    <IconCheck size={14} /> Réclamée aujourd'hui
                  </>
                ) : (
                  "Réclamer ma récompense"
                )}
              </Button>
            </motion.div>
          )}

          {phase === "claiming" && (
            <motion.div key="claiming" className="drm-content drm-content--center" {...fade}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <IconGold size={36} color="#c8960c" />
              </motion.div>
              <p className="drm-loading-text">Récupération en cours…</p>
            </motion.div>
          )}

          {phase === "rescue" && rescue && (
            <motion.div key="rescue" className="drm-content" {...fade}>
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconSkull size={22} color="#f27aaa" />
                  <h2 className="drm-header__title drm-header__title--danger">
                    Série de {rescue.streak} jours en danger
                  </h2>
                </div>
                <p className="drm-header__subtitle">
                  Tu as manqué hier. Sauve ta série aujourd'hui, demain il sera trop tard.
                </p>
              </div>

              {status && (
                <MonthCalendar today={today} claimedDates={status.claimedDates} rescuedDates={status.rescuedDates} />
              )}

              {error && <p className="drm-error">{error}</p>}

              <div className="drm-rescue-actions">
                <Button variant="primary-inverse" fullWidth onClick={handleRescue} disabled={missingGold > 0}>
                  <IconGold size={14} color="#c8960c" />
                  {missingGold > 0 ? `Il manque ${missingGold} gold` : `Sauver pour ${rescue.cost} gold`}
                </Button>
                <Button variant="danger-inverse" fullWidth onClick={handleRestart}>
                  Repartir à J1
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "result" && claimResult && (
            <motion.div key="result" className="drm-content" {...fade}>
              {claimResult.streakLost ? (
                <p className="drm-warning">
                  <IconSkull size={14} color="#f27aaa" />
                  Série de {claimResult.streakLost} jours perdue
                </p>
              ) : null}
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconPartyHorn size={22} color="#c8960c" />
                  <h2 className="drm-header__title">Récompense reçue !</h2>
                </div>
                <p className="drm-header__subtitle">
                  <IconFire size={12} color="#e05a00" /> Série :{" "}
                  <strong>
                    {claimResult.streak.current} jour{claimResult.streak.current > 1 ? "s" : ""}
                  </strong>
                </p>
              </div>

              <RewardList rewards={claimResult.rewards} />

              <MilestoneCard milestones={status?.milestones ?? []} streak={claimResult.streak.current} />

              <Button variant="primary-inverse" fullWidth onClick={onClose}>
                Super, merci !
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
