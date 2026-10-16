/** Règles pures du streak journalier. Les jours sont des chaînes YYYY-MM-DD en UTC. */

const DAY_MS = 86_400_000;

export const RESCUE_BASE_COST = 100;
export const RESCUE_COST_PER_STREAK_DAY = 10;

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function shiftDay(day: string, delta: number): string {
  return todayUtc(new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS));
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

export type ReturnGap =
  'first' | 'claimed_today' | 'consecutive' | 'rescuable' | 'lost';

/**
 * Situation du joueur aujourd'hui par rapport à son dernier claim :
 * 1 jour d'écart = consécutif, 2 = un jour manqué (rachetable), 3+ = série perdue.
 */
export function classifyGap(
  lastClaimDate: string | null,
  today: string,
): ReturnGap {
  if (!lastClaimDate) return 'first';
  const diff = daysBetween(lastClaimDate, today);
  if (diff <= 0) return 'claimed_today';
  if (diff === 1) return 'consecutive';
  if (diff === 2) return 'rescuable';
  return 'lost';
}

/** Plus la série est longue, plus la sauver coûte cher. */
export function rescueCost(streak: number): number {
  return RESCUE_BASE_COST + RESCUE_COST_PER_STREAK_DAY * streak;
}

/** Semaine de récompense du jour de streak (J1-J7 → 1, J8 → 2…). */
export function weekNumberFor(streakDay: number): number {
  return Math.floor((Math.max(streakDay, 1) - 1) / 7) + 1;
}

/** Position 1-7 du jour de streak dans le cycle hebdomadaire. */
export function cycleDayFor(streakDay: number): number {
  return ((Math.max(streakDay, 1) - 1) % 7) + 1;
}
