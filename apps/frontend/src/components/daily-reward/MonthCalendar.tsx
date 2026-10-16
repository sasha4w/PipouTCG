import "../DailyRewardModal.css";

const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

type DayState = "claimed" | "rescued" | "missed" | "today" | "future" | "past";

interface MonthCalendarProps {
  /** YYYY-MM-DD (UTC) : fixe le mois affiché et le jour courant. */
  today: string;
  claimedDates: string[];
  rescuedDates?: string[];
}

/**
 * Calendrier compact du mois courant. Un jour est « manqué » s'il est passé,
 * non réclamé, et postérieur au premier jour actif visible du mois.
 */
export default function MonthCalendar({
  today,
  claimedDates,
  rescuedDates = [],
}: MonthCalendarProps) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const prefix = today.slice(0, 8);
  const startOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const claimed = new Set(claimedDates);
  const rescued = new Set(rescuedDates);
  const firstActive =
    [...claimedDates, ...rescuedDates].filter((d) => d.startsWith(prefix)).sort()[0] ??
    null;

  const stateOf = (date: string): DayState => {
    if (claimed.has(date)) return "claimed";
    if (rescued.has(date)) return "rescued";
    if (date === today) return "today";
    if (date > today) return "future";
    return firstActive && date > firstActive ? "missed" : "past";
  };

  return (
    <div className="drm-cal">
      <div className="drm-cal__grid">
        {DAY_SHORT.map((d, i) => (
          <span key={`dow-${i}`} className="drm-cal__dow">
            {d}
          </span>
        ))}
      </div>
      <div className="drm-cal__grid drm-cal__grid--days">
        {Array.from({ length: startOffset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = `${prefix}${String(day).padStart(2, "0")}`;
          const state = stateOf(date);
          return (
            <span
              key={date}
              className={`drm-cal__day drm-cal__day--${state}`}
              data-state={state}
              data-today={date === today ? "true" : undefined}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
