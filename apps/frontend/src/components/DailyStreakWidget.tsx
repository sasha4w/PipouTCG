import { useQuery } from "@tanstack/react-query";
import { dailyRewardService } from "../services/dailyReward.service";
import { QUERY_KEYS } from "../utils/querykeys";
import { useDailyReward } from "../contexts/DailyRewardContext";
import "./DailyStreakWidget.css";

const REWARD_ICON: Record<string, string> = {
  gold: "🪙",
  card: "🃏",
  booster: "📦",
  bundle: "🎁",
};

export default function DailyStreakWidget() {
  const { openModal } = useDailyReward();

  const { data: status, isLoading } = useQuery({
    queryKey: QUERY_KEYS.dailyRewardStatus,
    queryFn: () => dailyRewardService.getStatus(),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !status) return null;

  const { streak, alreadyClaimed, daysMissed, nextReward, nextMilestone } =
    status;

  return (
    <div
      className={`dsw ${alreadyClaimed ? "dsw--claimed" : "dsw--unclaimed"}`}
      onClick={openModal}
      role="button"
      tabIndex={0}
    >
      {/* Indicateur de streak */}
      <div className="dsw__streak">
        <span className="dsw__streak-icon">
          {alreadyClaimed ? "✅" : daysMissed > 0 ? "⚠️" : "🔥"}
        </span>
        <div className="dsw__streak-info">
          <span className="dsw__streak-count">
            {streak.current} jour{streak.current > 1 ? "s" : ""}
          </span>
          <span className="dsw__streak-label">
            {alreadyClaimed
              ? "Réclamé aujourd'hui"
              : daysMissed > 0
                ? `${daysMissed} jour(s) manqué(s)`
                : "À réclamer !"}
          </span>
        </div>
      </div>

      {/* Miniature cycle 7j */}
      <div className="dsw__cycle">
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const isDone =
            day < streak.cycleDay ||
            (day === streak.cycleDay && alreadyClaimed);
          const isToday = day === streak.cycleDay && !alreadyClaimed;
          return (
            <div
              key={day}
              className={`dsw__dot ${isDone ? "done" : ""} ${isToday ? "today" : ""}`}
            />
          );
        })}
      </div>

      {/* Prochaine récompense */}
      {!alreadyClaimed && nextReward && (
        <div className="dsw__next">
          <span>{REWARD_ICON[nextReward.type]}</span>
          <span className="dsw__next-label">
            {nextReward.label ??
              (nextReward.type === "gold"
                ? `${nextReward.value * nextReward.quantity}g`
                : nextReward.type)}
          </span>
        </div>
      )}

      {/* Milestone */}
      {nextMilestone && nextMilestone.daysRemaining <= 7 && (
        <div className="dsw__milestone">
          🏆 J{nextMilestone.dayThreshold} dans {nextMilestone.daysRemaining}j
        </div>
      )}

      {/* Pulse si pas encore réclamé */}
      {!alreadyClaimed && <span className="dsw__ping" />}
    </div>
  );
}
