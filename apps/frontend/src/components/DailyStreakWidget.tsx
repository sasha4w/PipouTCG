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

/**
 * Retourne les 7 jours de la semaine courante (lundi → dimanche)
 * avec leur statut : claimed, today, missed, future
 */
function buildWeekDays(lastClaimDate: string | null, totalDays: number) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0=lundi
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    // On reconstitue les dates claimées à partir du lastClaimDate
    const claimedDates: string[] = [];
    if (lastClaimDate) {
      const last = new Date(lastClaimDate);
      for (let j = 0; j < Math.min(totalDays, 31); j++) {
        const cd = new Date(last);
        cd.setDate(cd.getDate() - j);
        claimedDates.push(cd.toISOString().slice(0, 10));
      }
    }

    return {
      date: d,
      dateStr: ds,
      dayNum: d.getDate(),
      isToday: ds === todayStr,
      isClaimed: claimedDates.includes(ds),
      isFuture: ds > todayStr,
    };
  });
}

const DAY_SHORT_WIDGET = ["L", "M", "M", "J", "V", "S", "D"];

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

  const weekDays = buildWeekDays(
    streak.lastClaimDate ?? null,
    streak.totalDays,
  );

  return (
    <div
      className={`dsw ${alreadyClaimed ? "dsw--claimed" : "dsw--unclaimed"}`}
      onClick={openModal}
      role="button"
      tabIndex={0}
    >
      {/* Streak info */}
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

      {/* Mini-calendrier semaine courante */}
      <div className="dsw__week">
        {weekDays.map((day, i) => (
          <div key={i} className="dsw__week-col">
            <span className="dsw__week-dow">{DAY_SHORT_WIDGET[i]}</span>
            <span
              className={[
                "dsw__week-day",
                day.isClaimed ? "claimed" : "",
                day.isToday ? "today" : "",
                !day.isClaimed && !day.isFuture && !day.isToday ? "missed" : "",
                day.isFuture ? "future" : "",
              ].join(" ")}
            >
              {day.isClaimed ? "✓" : day.dayNum}
            </span>
          </div>
        ))}
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

      {/* Milestone proche (≤ 3 jours) */}
      {nextMilestone && nextMilestone.daysRemaining <= 3 && (
        <div className="dsw__milestone">
          🏆 J{nextMilestone.dayThreshold} dans {nextMilestone.daysRemaining}j
        </div>
      )}

      {/* Pulse */}
      {!alreadyClaimed && <span className="dsw__ping" />}
    </div>
  );
}
