import type { PuzzleStreak } from '@pipou/shared';
import { addDays } from './puzzle-schedule';

export const STREAK_BOOSTER_EVERY = 7;

export function earnsBooster(current: number): boolean {
  return current > 0 && current % STREAK_BOOSTER_EVERY === 0;
}

/** `days` : jours de défi résolus ('YYYY-MM-DD'), sans ordre imposé. */
export function computeStreak(days: string[], today: string): PuzzleStreak {
  const solved = new Set(days);
  let longest = 0;
  for (const day of solved) {
    if (solved.has(addDays(day, -1))) continue; // pas un début de série
    let len = 1;
    while (solved.has(addDays(day, len))) len++;
    longest = Math.max(longest, len);
  }
  // Tant qu'aujourd'hui n'est pas joué, la série d'hier reste en cours.
  let cursor = solved.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (solved.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return {
    current,
    longest,
    nextBoosterIn: STREAK_BOOSTER_EVERY - (current % STREAK_BOOSTER_EVERY),
  };
}
