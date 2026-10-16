import { useQuery } from "@tanstack/react-query";
import { dailyRewardService } from "../services/dailyReward.service";
import { QUERY_KEYS } from "../utils/querykeys";
import { useDailyReward } from "../contexts/DailyRewardContext";
import { IconCheck, IconFire, IconSkull, IconTrophy } from "./Icons";
import { RewardIcon, rewardText, todayUtc } from "./daily-reward/rewardDisplay";
import "./DailyStreakWidget.css";

/** 7 jours de la semaine courante (lundi → dimanche), en UTC comme le serveur. */
function buildWeekDays(today: string, claimedDates: string[]) {
  const claimed = new Set(claimedDates);
  const base = new Date(`${today}T00:00:00Z`);
  const dow = (base.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - dow + i);
    const ds = d.toISOString().slice(0, 10);
    return {
      dateStr: ds,
      dayNum: d.getUTCDate(),
      isToday: ds === today,
      isClaimed: claimed.has(ds),
      isFuture: ds > today,
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

  const {
    streak,
    alreadyClaimed,
    rescueAvailable,
    streakAtRisk,
    nextReward,
    milestones,
  } = status;
  const today = todayUtc();
  const weekDays = buildWeekDays(today, [
    ...status.claimedDates,
    ...status.rescuedDates,
  ]);
  // Claiming resets the streak to 1 when it is at risk: progress restarts from 0.
  const progressStreak = streakAtRisk ? 0 : streak.current;
  const nextMilestone = milestones.find((m) => m.dayThreshold > progressStreak);
  const daysToMilestone = nextMilestone
    ? nextMilestone.dayThreshold - progressStreak
    : null;
  const inDanger = rescueAvailable || streakAtRisk;

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
          {alreadyClaimed ? (
            <IconCheck size={18} color="#70b870" />
          ) : inDanger ? (
            <IconSkull size={18} color="#f27aaa" />
          ) : (
            <IconFire size={18} color="#e05a00" />
          )}
        </span>
        <div className="dsw__streak-info">
          <span className="dsw__streak-count">
            {streak.current} jour{streak.current > 1 ? "s" : ""}
          </span>
          <span className="dsw__streak-label">
            {alreadyClaimed
              ? "Réclamé aujourd'hui"
              : rescueAvailable
                ? "Série en danger"
                : streakAtRisk
                  ? "Série perdue"
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
              {day.isClaimed ? <IconCheck size={10} /> : day.dayNum}
            </span>
          </div>
        ))}
      </div>

      {/* Prochaine récompense */}
      {!alreadyClaimed && nextReward && (
        <div className="dsw__next">
          <RewardIcon type={nextReward.type} size={16} />
          <span className="dsw__next-label">{rewardText(nextReward)}</span>
        </div>
      )}

      {/* Milestone proche (≤ 3 jours) */}
      {nextMilestone && daysToMilestone !== null && daysToMilestone <= 3 && (
        <div className="dsw__milestone">
          <IconTrophy size={12} color="#eebc77" /> J{nextMilestone.dayThreshold}{" "}
          dans {daysToMilestone}j
        </div>
      )}

      {/* Pulse */}
      {!alreadyClaimed && <span className="dsw__ping" />}
    </div>
  );
}
