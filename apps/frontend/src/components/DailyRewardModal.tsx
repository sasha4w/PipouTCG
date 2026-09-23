import { useState, type JSX } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  dailyRewardService,
  type ClaimResult,
  type DailyReward,
} from "../services/dailyReward.service";
import { QUERY_KEYS } from "../utils/querykeys";
import type { ToastType } from "../hooks/useToast";
import "./DailyRewardModal.css";
import {
  IconFire,
  IconCalendar,
  IconGold,
  IconCards,
  IconBooster,
  IconBundle,
  IconPartyHorn,
  IconSkull,
} from "./Icons";

// ── Helpers ────────────────────────────────────────────────────────────────

const REWARD_ICON: Record<string, JSX.Element> = {
  gold: <IconGold size={28} color="#c8960c" />,
  card: <IconCards size={28} color="#7a1c3b" />,
  booster: <IconBooster size={28} color="#7a1c3b" />,
  bundle: <IconBundle size={28} color="#7a1c3b" />,
};

const REWARD_LABEL: Record<string, string> = {
  gold: "Gold",
  card: "Carte",
  booster: "Booster",
  bundle: "Bundle",
};

const MONTH_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

// ── Types ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "claiming" | "result" | "rescue" | "resetting";

interface DailyRewardModalProps {
  onClose: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

// ── Calendrier mensuel ────────────────────────────────────────────────────

/**
 * Construit un calendrier mensuel pour le mois courant.
 * claimedDates : tableau de strings YYYY-MM-DD déjà réclamés.
 * lastClaimDate : string YYYY-MM-DD du dernier claim.
 */
function MonthCalendar({
  claimedDates,
  lastClaimDate,
}: {
  claimedDates: string[];
  lastClaimDate: string | null;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayNum = now.getDate();

  // Premier jour du mois (0=dim → on décale pour lundi)
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = (firstDow + 6) % 7; // 0=lun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(todayNum).padStart(2, "0")}`;
  const claimedSet = new Set(claimedDates);

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < startOffset; i++)
    cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr: ds });
  }

  return (
    <div className="drm-calendar">
      <div className="drm-calendar__header">
        {DAY_SHORT.map((d, i) => (
          <span key={i} className="drm-calendar__dow">
            {d}
          </span>
        ))}
      </div>
      <div className="drm-calendar__grid">
        {cells.map((cell, i) => {
          if (!cell.day || !cell.dateStr) {
            return <span key={i} className="drm-calendar__empty" />;
          }
          const isClaimed = claimedSet.has(cell.dateStr);
          const isToday = cell.dateStr === todayStr;
          const isPast = cell.day < todayNum && !isClaimed;
          const isMissed = isPast && !isClaimed && cell.dateStr < todayStr;
          const isLast = cell.dateStr === lastClaimDate;

          return (
            <motion.span
              key={i}
              className={[
                "drm-calendar__day",
                isClaimed ? "claimed" : "",
                isToday ? "today" : "",
                isMissed ? "missed" : "",
                isLast ? "last" : "",
              ].join(" ")}
              initial={isClaimed ? { scale: 0.6 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: i * 0.01 }}
            >
              {cell.day}
            </motion.span>
          );
        })}
      </div>
      <div className="drm-calendar__legend">
        <span>
          <span className="drm-legend-dot claimed" />
          Réclamé
        </span>
        <span>
          <span className="drm-legend-dot today" />
          Aujourd'hui
        </span>
        <span>
          <span className="drm-legend-dot missed" />
          Manqué
        </span>
      </div>
    </div>
  );
}

// ── MilestoneTracker ──────────────────────────────────────────────────────

const MILESTONE_THRESHOLDS = [
  7, 14, 21, 30, 50, 60, 77, 100, 120, 180, 270, 365, 500,
];

function MilestoneTracker({ totalDays }: { totalDays: number }) {
  const visibleMilestones = MILESTONE_THRESHOLDS.slice(0, 8); // affiche les 8 prochains + passés
  const nextIdx = visibleMilestones.findIndex((t) => t > totalDays);
  const next = nextIdx !== -1 ? visibleMilestones[nextIdx] : null;

  return (
    <div className="drm-milestones">
      <div className="drm-milestones__title">Paliers de fidélité</div>
      <div className="drm-milestones__track">
        {/* Barre de progression */}
        <div className="drm-milestones__bar">
          <motion.div
            className="drm-milestones__fill"
            initial={{ width: 0 }}
            animate={{
              width: next
                ? `${Math.min((totalDays / next) * 100, 100)}%`
                : "100%",
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {/* Points de palier */}
        <div className="drm-milestones__nodes">
          {visibleMilestones.map((threshold) => {
            const done = totalDays >= threshold;
            const isNext = threshold === next;
            const remaining = threshold - totalDays;
            return (
              <div
                key={threshold}
                className={`drm-ms-node ${done ? "done" : ""} ${isNext ? "next" : ""}`}
              >
                <div className="drm-ms-node__dot">
                  {done ? "✓" : isNext ? "⭐" : ""}
                </div>
                <span className="drm-ms-node__label">
                  {done
                    ? `J${threshold}`
                    : isNext
                      ? `-${remaining}j`
                      : `J${threshold}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function DailyRewardModal({
  onClose,
  addToast,
}: DailyRewardModalProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [rescueDays, setRescueDays] = useState(1);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const status = queryClient.getQueryData<any>(QUERY_KEYS.dailyRewardStatus);

  // Récupère l'historique des claims du mois courant depuis le cache ou le service
  // Pour simplifier : on déduit les dates depuis streak.totalDays + lastClaimDate
  // Idéalement, passer l'historique comme prop ou via une query dédiée
  const buildClaimedDates = (): string[] => {
    if (!status?.streak?.lastClaimDate) return [];
    const dates: string[] = [];
    const last = new Date(status.streak.lastClaimDate);
    const totalDays = status.streak.totalDays;
    for (let i = 0; i < Math.min(totalDays, 31); i++) {
      const d = new Date(last);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  // ── Claim ────────────────────────────────────────────────────────────────

  const handleClaim = async () => {
    setPhase("claiming");
    setError("");
    try {
      const result = await dailyRewardService.claimDaily();
      setClaimResult(result);
      if (result.status === "rescue_required") {
        setPhase("rescue");
      } else {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.dailyRewardStatus,
        });
        setPhase("result");
      }
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Erreur lors du claim.");
      setPhase("idle");
    }
  };

  // ── Rescue ───────────────────────────────────────────────────────────────

  const handleRescue = async () => {
    setPhase("claiming");
    try {
      const res = await dailyRewardService.rescueStreak(rescueDays);
      addToast(`Streak sauvegardée ! ${res.goldSpent}g dépensés.`, "success");
      const result = await dailyRewardService.claimDaily();
      setClaimResult(result);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyRewardStatus });
      setPhase("result");
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Erreur lors du rachat.");
      setPhase("rescue");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleReset = async () => {
    setIsResetting(true);
    setError("");
    try {
      await dailyRewardService.resetStreak();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyRewardStatus });
      addToast("Streak réinitialisée. Tu repars de J1 !", "warning");
      onClose();
    } catch (e: any) {
      setError(
        e.response?.data?.message ?? "Erreur lors de la réinitialisation.",
      );
      setIsResetting(false);
    }
  };

  // ── Rendu récompenses ─────────────────────────────────────────────────────

  const renderRewards = (rewards: DailyReward[]) => (
    <div className="drm-rewards">
      {rewards.map((r, i) => (
        <motion.div
          key={i}
          className={`drm-reward ${r.isMilestone ? "drm-reward--milestone" : ""}`}
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.15, type: "spring", damping: 14 }}
        >
          <span className="drm-reward__icon">{REWARD_ICON[r.type]}</span>
          <span className="drm-reward__qty">
            {r.type === "gold" ? `+${r.value * r.quantity}` : `x${r.quantity}`}
          </span>
          <span className="drm-reward__type">
            {r.label ?? REWARD_LABEL[r.type]}
          </span>
          {r.isMilestone && (
            <span className="drm-reward__milestone-badge">🏆 Palier</span>
          )}
        </motion.div>
      ))}
    </div>
  );

  const claimedDates = buildClaimedDates();

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
          <button className="drm-close" onClick={onClose}>
            ✕
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── Idle ── */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">
                  <IconCalendar size={32} color="#eebc77" />
                </span>
                <h2 className="drm-header__title">
                  {MONTH_FR[new Date().getMonth()]} {new Date().getFullYear()}
                </h2>
                {status && (
                  <div className="drm-header__stats">
                    <span className="drm-stat">
                      <IconFire size={14} color="#e05a00" />
                      <strong>{status.streak.current}</strong> consécutifs
                    </span>
                    <span className="drm-stat-sep">·</span>
                    <span className="drm-stat">
                      <strong>{status.streak.totalDays}</strong> au total
                    </span>
                    {status.streak.longest > 0 && (
                      <>
                        <span className="drm-stat-sep">·</span>
                        <span className="drm-stat">
                          record <strong>{status.streak.longest}</strong>j
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Calendrier mensuel */}
              <MonthCalendar
                claimedDates={claimedDates}
                lastClaimDate={status?.streak?.lastClaimDate ?? null}
              />

              {/* Récompense du jour */}
              {status?.nextReward && (
                <div className="drm-next-reward">
                  <span className="drm-next-reward__label">
                    Récompense du jour
                  </span>
                  <div className="drm-next-reward__item">
                    <span>{REWARD_ICON[status.nextReward.type]}</span>
                    <span>
                      {status.nextReward.label ??
                        (status.nextReward.type === "gold"
                          ? `${status.nextReward.value * status.nextReward.quantity} gold`
                          : `${status.nextReward.quantity}× ${REWARD_LABEL[status.nextReward.type]}`)}
                    </span>
                  </div>
                </div>
              )}

              {/* Milestones tracker */}
              {status && (
                <MilestoneTracker totalDays={status.streak.totalDays} />
              )}

              {error && <p className="drm-error">{error}</p>}

              <button
                className="drm-claim-btn"
                onClick={handleClaim}
                disabled={status?.alreadyClaimed}
              >
                {status?.alreadyClaimed
                  ? "✓ Récompense réclamée aujourd'hui"
                  : "Réclamer ma récompense !"}
              </button>
            </motion.div>
          )}

          {/* ── Claiming ── */}
          {phase === "claiming" && (
            <motion.div
              key="claiming"
              className="drm-content drm-content--center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="drm-loading-icon"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                ⭐
              </motion.div>
              <p className="drm-loading-text">Récupération en cours…</p>
            </motion.div>
          )}

          {/* ── Rescue ── */}
          {phase === "rescue" && claimResult?.rescue && (
            <motion.div
              key="rescue"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">
                  <IconSkull size={32} color="#f27aaa" />
                </span>
                <h2 className="drm-header__title drm-header__title--danger">
                  Streak en danger !
                </h2>
                <p className="drm-header__subtitle">
                  Tu as manqué{" "}
                  <strong>{claimResult.rescue.daysMissed} jour(s)</strong>.
                  Rachète en gold ou repars de zéro.
                </p>
              </div>

              {/* Calendrier avec les jours manqués visibles */}
              <MonthCalendar
                claimedDates={claimedDates}
                lastClaimDate={status?.streak?.lastClaimDate ?? null}
              />

              <div className="drm-rescue-options">
                {claimResult.rescue.costPerScenario.map((cost, i) => (
                  <button
                    key={i}
                    className={`drm-rescue-option ${rescueDays === i + 1 ? "selected" : ""}`}
                    onClick={() => setRescueDays(i + 1)}
                  >
                    <span>
                      {i + 1} jour{i > 0 ? "s" : ""}
                    </span>
                    <span className="drm-rescue-option__cost">
                      <IconGold size={14} color="#c8960c" />
                      {cost}g
                    </span>
                  </button>
                ))}
              </div>

              {error && <p className="drm-error">{error}</p>}

              <div className="drm-rescue-actions">
                <button
                  className="drm-rescue-btn"
                  onClick={handleRescue}
                  disabled={isResetting}
                >
                  <IconGold size={14} color="#c8960c" />
                  Racheter ({claimResult.rescue.costPerScenario[rescueDays - 1]}
                  g)
                </button>
                <button
                  className="drm-reset-btn"
                  onClick={handleReset}
                  disabled={isResetting}
                >
                  {isResetting ? "Réinitialisation..." : "Recommencer à J1"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Résultat ── */}
          {phase === "result" && claimResult?.rewards && (
            <motion.div
              key="result"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">
                  <IconPartyHorn size={32} color="#c8960c" />
                </span>
                <h2 className="drm-header__title">Récompense reçue !</h2>
                <p className="drm-header__streak">
                  <IconFire size={16} color="#e05a00" /> Streak :{" "}
                  <strong>
                    {claimResult.streak.current} jour
                    {claimResult.streak.current > 1 ? "s" : ""}
                  </strong>
                </p>
              </div>

              {renderRewards(claimResult.rewards)}

              {/* Calendrier mis à jour post-claim */}
              <MonthCalendar
                claimedDates={[
                  ...claimedDates,
                  new Date().toISOString().slice(0, 10),
                ]}
                lastClaimDate={new Date().toISOString().slice(0, 10)}
              />

              {/* Milestone tracker post-claim */}
              <MilestoneTracker totalDays={claimResult.streak.totalDays} />

              <button className="drm-close-btn" onClick={onClose}>
                Super, merci !
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
