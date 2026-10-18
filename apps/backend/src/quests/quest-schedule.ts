export const RESET_HOUR = 4;
/** 0 = dimanche, 1 = lundi. */
export const WEEKLY_RESET_DAY = 1;
/** Quêtes tirées par joueur et par période. */
export const POOL_DRAW_SIZE = 3;

export function lastDailyReset(now: Date): Date {
  const d = new Date(now);
  d.setHours(RESET_HOUR, 0, 0, 0);
  if (d > now) d.setDate(d.getDate() - 1);
  return d;
}

export function nextDailyReset(now: Date): Date {
  const d = lastDailyReset(now);
  d.setDate(d.getDate() + 1);
  return d;
}

export function nextWeeklyReset(now: Date): Date {
  const d = new Date(now);
  d.setHours(RESET_HOUR, 0, 0, 0);
  let days = (WEEKLY_RESET_DAY - d.getDay() + 7) % 7;
  if (days === 0 && d <= now) days = 7;
  d.setDate(d.getDate() + days);
  return d;
}

/** Une relance par journée de jeu (entre deux resets daily). */
export function isRerollAvailable(
  lastRerollAt: Date | null,
  now: Date,
): boolean {
  return !lastRerollAt || lastRerollAt < lastDailyReset(now);
}

/** n éléments distincts tirés uniformément (Fisher-Yates partiel). */
export function drawDistinct<T>(
  items: T[],
  n: number,
  rng: () => number = Math.random,
): T[] {
  const pool = [...items];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
