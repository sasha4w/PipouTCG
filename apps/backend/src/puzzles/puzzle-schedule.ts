import { lastDailyReset } from '../quests/quest-schedule';

const pad = (n: number) => String(n).padStart(2, '0');
// Heure locale, comme lastDailyReset (qui utilise setHours/getDate locaux).
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Jour de défi courant : il change à l'heure de reset des quêtes, pas à minuit. */
export function puzzleDay(now: Date): string {
  return fmt(lastDailyReset(now));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export interface FallbackCandidate {
  id: number;
  lastPlayed: string | null;
}

/** Défi le moins récemment joué : rotation équitable quand rien n'est programmé. */
export function pickFallback(candidates: FallbackCandidate[]): number | null {
  const sorted = [...candidates].sort(
    (a, b) =>
      (a.lastPlayed ?? '').localeCompare(b.lastPlayed ?? '') || a.id - b.id,
  );
  return sorted[0]?.id ?? null;
}
