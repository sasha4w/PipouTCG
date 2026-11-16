import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PuzzleScheduleOrigin, PuzzleStatus } from "@pipou/shared";
import type { AdminPuzzle, PuzzleScheduleEntry } from "@pipou/shared";
import { puzzleService } from "../../../services/puzzle.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage } from "../../../utils/errors";
import { IconAlert } from "../../../components/Icons";
import "../../../components/manager.css";
import "./PuzzleAdmin.css";

/** En dessous, le repli automatique risque de resservir des défis déjà joués. */
const LOW_STOCK = 7;
const FREE = "";

interface Props {
  puzzles: AdminPuzzle[];
}

/** Calendrier des 14 prochains jours : un défi publié (vérifié) par date, ou libre. */
export default function PuzzleCalendar({ puzzles }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const schedule = useQuery({
    queryKey: QUERY_KEYS.admin.puzzleSchedule,
    queryFn: () => puzzleService.schedule(14),
  });
  const assign = useMutation({
    mutationFn: (v: { date: string; puzzleId: number | null }) =>
      puzzleService.setSchedule(v),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.puzzles }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.puzzleSchedule }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.puzzleToday }),
      ]),
  });

  const published = puzzles.filter(
    (p) => p.status === PuzzleStatus.PUBLISHED && p.verifiedAt !== null,
  );
  const count = puzzles.filter((p) => p.status === PuzzleStatus.PUBLISHED).length;

  function origin(entry: PuzzleScheduleEntry): string {
    if (entry.origin === PuzzleScheduleOrigin.MANUAL)
      return t("puzzle.admin.origin_manual");
    if (entry.origin === PuzzleScheduleOrigin.AUTO)
      return t("puzzle.admin.origin_auto");
    return t("puzzle.admin.origin_free");
  }

  return (
    <section className="pz-calendar">
      <h3 className="manager-form__title">{t("puzzle.admin.calendar_title")}</h3>
      {schedule.isError && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(schedule.error)}
        </p>
      )}
      {assign.isError && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(assign.error)}
        </p>
      )}
      <ul className="manager-list">
        {schedule.data?.map((entry) => (
          <li key={entry.date} className="pz-calendar__row">
            <span className="pz-calendar__date">
              {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                i18n.language,
                { weekday: "short", day: "numeric", month: "short" },
              )}
            </span>
            <select
              className="manager-form__select"
              aria-label={t("puzzle.admin.calendar_select", { date: entry.date })}
              value={entry.puzzleId === null ? FREE : String(entry.puzzleId)}
              disabled={assign.isPending}
              onChange={(e) =>
                assign.mutate({
                  date: entry.date,
                  puzzleId: e.target.value === FREE ? null : Number(e.target.value),
                })
              }
            >
              <option value={FREE}>{t("puzzle.admin.calendar_free")}</option>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              {entry.puzzleId !== null &&
                !published.some((p) => p.id === entry.puzzleId) && (
                  <option value={entry.puzzleId}>
                    {entry.title ?? `#${entry.puzzleId}`}
                  </option>
                )}
            </select>
            <span className="manager-item__meta">{origin(entry)}</span>
          </li>
        ))}
      </ul>
      <p className={`pz-count${count < LOW_STOCK ? " pz-count--low" : ""}`}>
        {t("puzzle.admin.published_count", { count })}
      </p>
      {count < LOW_STOCK && (
        <p className="pz-warning">
          <IconAlert size={14} /> {t("puzzle.admin.low_stock")}
        </p>
      )}
    </section>
  );
}
