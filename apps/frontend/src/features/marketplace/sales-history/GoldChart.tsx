import { useState } from "react";
import type { CSSProperties } from "react";
import type { SalesStats } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import "./GoldChart.css";

interface GoldChartProps {
  daily: SalesStats["daily"];
  bestDay: SalesStats["bestDay"];
}

/** Repères de l'axe : premier jour, milieu, aujourd'hui. */
const AXIS_INDEXES = [0, 14, 29];

const GoldChart = ({ daily, bestDay }: GoldChartProps) => {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const max = Math.max(0, ...daily.map((d) => d.gold));
  if (max === 0) {
    return <p className="gold-chart__empty">{t("marketplace.sales.chart_empty")}</p>;
  }

  const shortDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  const barLabel = (index: number) =>
    t("marketplace.sales.chart_bar", {
      date: shortDate(daily[index].date),
      gold: daily[index].gold,
    });

  return (
    <figure className="gold-chart" aria-label={t("marketplace.sales.chart_label")}>
      <div className="gold-chart__bars">
        {daily.map((day, index) => {
          const isBest = bestDay?.date === day.date;
          const style = {
            height: day.gold ? `${(day.gold / max) * 100}%` : undefined,
            "--bar-index": index,
          } as CSSProperties;
          return (
            <div key={day.date} className="gold-chart__col">
              {isBest && (
                <span className="gold-chart__crown" aria-hidden="true">
                  👑
                </span>
              )}
              {day.gold > 0 ? (
                <button
                  type="button"
                  className={`gold-chart__bar${isBest ? " gold-chart__bar--best" : ""}${
                    selected === index ? " gold-chart__bar--selected" : ""
                  }`}
                  style={style}
                  aria-label={barLabel(index)}
                  onClick={() => setSelected(selected === index ? null : index)}
                />
              ) : (
                <span className="gold-chart__bar gold-chart__bar--empty" />
              )}
            </div>
          );
        })}
      </div>
      <div className="gold-chart__axis" aria-hidden="true">
        {AXIS_INDEXES.map((index) => (
          <span key={index}>
            {index === daily.length - 1
              ? t("marketplace.sales.today")
              : shortDate(daily[index].date)}
          </span>
        ))}
      </div>
      {selected !== null && (
        <p className="gold-chart__tooltip" role="status">
          {barLabel(selected)}
        </p>
      )}
    </figure>
  );
};

export default GoldChart;
