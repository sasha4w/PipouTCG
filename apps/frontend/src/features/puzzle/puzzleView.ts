import { PuzzleObjectiveType } from "@pipou/shared";
import type { PuzzleObjectiveView, PuzzleStreak } from "@pipou/shared";

/** Longueur d'un cycle de série : le dernier jour offre un booster. */
const STREAK_CYCLE = 7;

/** Clé i18n et variables du texte d'objectif. */
export function objectiveText(o: PuzzleObjectiveView): {
  key: string;
  vars: Record<string, string | number>;
} {
  switch (o.type) {
    case PuzzleObjectiveType.DESTROY_MONSTER:
      return {
        key: "puzzle.objective.DESTROY_MONSTER",
        vars: { name: o.targetName ?? "?" },
      };
    case PuzzleObjectiveType.TAKE_PRIMES:
      // `count` choisit la forme singulier / pluriel
      return {
        key: "puzzle.objective.TAKE_PRIMES",
        vars: { count: o.primes ?? 1 },
      };
    default:
      return { key: `puzzle.objective.${o.type}`, vars: {} };
  }
}

/** Points de série affichés : 7 par cycle, le dernier est le cadeau. */
export function streakDots(
  streak: PuzzleStreak,
): { filled: boolean; gift: boolean }[] {
  const filledCount = STREAK_CYCLE - streak.nextBoosterIn;
  return Array.from({ length: STREAK_CYCLE }, (_, i) => ({
    filled: i < filledCount,
    gift: i === STREAK_CYCLE - 1,
  }));
}

/** Compte à rebours « HH:MM:SS », borné à zéro. */
export function countdown(nextResetAt: string, now: number): string {
  const ms = Math.max(0, new Date(nextResetAt).getTime() - now);
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Routes du défi : la fiche, puis l'écran de jeu. */
export const PUZZLE_PATH = "/puzzle";
export const PUZZLE_PLAY_PATH = "/puzzle/play";
