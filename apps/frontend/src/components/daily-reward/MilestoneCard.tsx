/* eslint-disable react-refresh/only-export-components -- helpers purs exportés pour les tests/le widget */
import { motion } from "framer-motion";
import { stripEmoji, type DailyRewardMilestone } from "@pipou/shared";
import { IconTrophy } from "../Icons";
import { RewardIcon, rewardText } from "./rewardDisplay";
import "../DailyRewardModal.css";

/** 2 derniers paliers atteints, le prochain et les 3 suivants. */
export function visibleChips(
  milestones: DailyRewardMilestone[],
  streak: number,
): DailyRewardMilestone[] {
  const nextIdx = milestones.findIndex((m) => m.dayThreshold > streak);
  const pivot = nextIdx === -1 ? milestones.length : nextIdx;
  return milestones.slice(Math.max(pivot - 2, 0), pivot + 4);
}

interface MilestoneCardProps {
  milestones: DailyRewardMilestone[];
  streak: number;
}

export default function MilestoneCard({ milestones, streak }: MilestoneCardProps) {
  if (milestones.length === 0) return null;
  const next = milestones.find((m) => m.dayThreshold > streak) ?? null;

  return (
    <div className="drm-ms">
      {next ? (
        <div className="drm-ms__main">
          <span className="drm-ms__icon">
            <RewardIcon type={next.type} size={26} />
          </span>
          <div className="drm-ms__body">
            <span className="drm-ms__title">
              J{next.dayThreshold} · {stripEmoji(next.label) ?? rewardText(next)}
            </span>
            <span className="drm-ms__count">
              {streak} / {next.dayThreshold} jours consécutifs
            </span>
            <div
              className="drm-ms__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={next.dayThreshold}
              aria-valuenow={streak}
            >
              <motion.div
                className="drm-ms__fill"
                initial={{ width: 0 }}
                animate={{ width: `${(streak / next.dayThreshold) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="drm-ms__done">
          <IconTrophy size={18} color="#eebc77" />
          Tous les paliers atteints
        </div>
      )}
      <div className="drm-ms__chips">
        {visibleChips(milestones, streak).map((m) => (
          <span
            key={m.dayThreshold}
            className={[
              "drm-ms__chip",
              m.dayThreshold <= streak ? "is-done" : "",
              m === next ? "is-next" : "",
            ].join(" ")}
          >
            J{m.dayThreshold}
          </span>
        ))}
      </div>
    </div>
  );
}
