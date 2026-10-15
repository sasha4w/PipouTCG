import type { SalesStats } from '@pipou/shared';

export const CHART_DAYS = 30;

type Daily = SalesStats['daily'];

const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Minuit UTC du premier jour du graphique (J-29). */
export function chartStart(now: Date): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(today - (CHART_DAYS - 1) * DAY_MS);
}

/** Or échangé par jour UTC, de J-29 à aujourd'hui, jours vides à 0. */
export function bucketDaily(
  sales: { date: Date; gold: number }[],
  now: Date,
): Daily {
  const start = chartStart(now).getTime();
  const days = Array.from({ length: CHART_DAYS }, (_, i) => ({
    date: isoDay(new Date(start + i * DAY_MS)),
    gold: 0,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const sale of sales) {
    const day = byDate.get(isoDay(sale.date));
    if (day) day.gold += sale.gold;
  }
  return days;
}

export function bestDay(daily: Daily): SalesStats['bestDay'] {
  const best = daily.reduce<Daily[number] | null>(
    (top, d) => (d.gold > (top?.gold ?? 0) ? d : top),
    null,
  );
  return best ? { ...best } : null;
}

export function trend(daily: Daily): SalesStats['trend'] {
  const sum = (days: Daily) => days.reduce((s, d) => s + d.gold, 0);
  const last7 = sum(daily.slice(-7));
  const previous7 = sum(daily.slice(-14, -7));
  const percent =
    previous7 === 0
      ? null
      : Math.round(((last7 - previous7) / previous7) * 100);
  return { last7, previous7, percent };
}

/** MySQL renvoie les SUM/MIN/MAX de BIGINT en chaîne, et null sur un ensemble vide. */
export function toNumber(value: string | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export function toNullableNumber(
  value: string | number | null | undefined,
): number | null {
  return value == null ? null : Number(value);
}

/** Prix moyen par unité, pondéré par les quantités. */
export function avgUnitPrice(totalGold: number, units: number): number | null {
  return units > 0 ? Math.round(totalGold / units) : null;
}
