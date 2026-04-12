import { useState } from "react";
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

// ── Helpers ────────────────────────────────────────────────────────────────

const REWARD_ICON: Record<string, string> = {
  gold: "🪙",
  card: "🃏",
  booster: "📦",
  bundle: "🎁",
};

const REWARD_LABEL: Record<string, string> = {
  gold: "Gold",
  card: "Carte",
  booster: "Booster",
  bundle: "Bundle",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// ── Types ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "claiming" | "result" | "rescue" | "resetting";

interface DailyRewardModalProps {
  onClose: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

// ── Composant ─────────────────────────────────────────────────────────────

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
      // Après le rescue, on claim automatiquement
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
    setIsResetting(true); // On utilise l'état local
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
      setIsResetting(false); // On libère le bouton en cas d'erreur
    }
  };

  // ── Cycle 7j visuel ───────────────────────────────────────────────────────

  const currentCycleDay = status?.streak?.cycleDay ?? 1;

  const renderCycleBar = () => (
    <div className="drm-cycle">
      {DAY_LABELS.map((label, i) => {
        const day = i + 1;
        const isDone = day < currentCycleDay;
        const isToday = day === currentCycleDay;
        return (
          <div
            key={day}
            className={`drm-cycle__day ${isDone ? "done" : ""} ${isToday ? "today" : ""}`}
          >
            <div className="drm-cycle__dot">
              {isDone ? "✓" : isToday ? "★" : day}
            </div>
            <span className="drm-cycle__label">{label}</span>
          </div>
        );
      })}
    </div>
  );

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
          {/* ── Idle : invitation à claim ── */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">📅</span>
                <h2 className="drm-header__title">Récompense journalière</h2>
                {status && (
                  <p className="drm-header__streak">
                    🔥 Streak :{" "}
                    <strong>
                      {status.streak.current} jour
                      {status.streak.current > 1 ? "s" : ""}
                    </strong>
                  </p>
                )}
              </div>

              {renderCycleBar()}

              {status?.nextReward && (
                <div className="drm-next-reward">
                  <span className="drm-next-reward__label">
                    Récompense du jour
                  </span>
                  <div className="drm-next-reward__item">
                    <span>{REWARD_ICON[status.nextReward.type]}</span>
                    <span>
                      {status.nextReward.label ??
                        `${
                          status.nextReward.type === "gold"
                            ? `${status.nextReward.value * status.nextReward.quantity} gold`
                            : `${status.nextReward.quantity}x ${REWARD_LABEL[status.nextReward.type]}`
                        }`}
                    </span>
                  </div>
                </div>
              )}

              {status?.nextMilestone && (
                <div className="drm-milestone-hint">
                  🏆 Prochain palier dans{" "}
                  <strong>
                    {status.nextMilestone.daysRemaining} jour
                    {status.nextMilestone.daysRemaining > 1 ? "s" : ""}
                  </strong>
                  {status.nextMilestone.label &&
                    ` — ${status.nextMilestone.label}`}
                </div>
              )}

              {error && <p className="drm-error">{error}</p>}

              <button className="drm-claim-btn" onClick={handleClaim}>
                Réclamer ma récompense !
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

          {/* ── Rescue requis ── */}
          {phase === "rescue" && claimResult?.rescue && (
            <motion.div
              key="rescue"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">😬</span>
                <h2 className="drm-header__title">Streak en danger !</h2>
                <p className="drm-header__subtitle">
                  Tu as manqué{" "}
                  <strong>{claimResult.rescue.daysMissed} jour(s)</strong>. Tu
                  peux racheter jusqu'à{" "}
                  <strong>{claimResult.rescue.maxRescuable} jour(s)</strong> en
                  gold.
                </p>
              </div>

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
                    <span className="drm-rescue-option__cost">🪙 {cost}g</span>
                  </button>
                ))}
              </div>

              {error && <p className="drm-error">{error}</p>}

              <div className="drm-rescue-actions">
                <button
                  className="drm-rescue-btn"
                  onClick={handleRescue}
                  disabled={isResetting || (phase as Phase) === "claiming"}
                >
                  💰 Racheter (
                  {claimResult.rescue.costPerScenario[rescueDays - 1]}g)
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

          {/* ── Résultat du claim ── */}
          {phase === "result" && claimResult?.rewards && (
            <motion.div
              key="result"
              className="drm-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="drm-header">
                <span className="drm-header__icon">🎉</span>
                <h2 className="drm-header__title">Récompense reçue !</h2>
                <p className="drm-header__streak">
                  🔥 Streak :{" "}
                  <strong>
                    {claimResult.streak.current} jour
                    {claimResult.streak.current > 1 ? "s" : ""}
                  </strong>
                </p>
              </div>

              {renderRewards(claimResult.rewards)}

              {renderCycleBar()}

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
