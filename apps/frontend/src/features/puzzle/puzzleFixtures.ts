import { PuzzleObjectiveType } from "@pipou/shared";
import type { DailyPuzzleInfo } from "@pipou/shared";

/** Défi du jour de test ; `over` surcharge les champs de premier niveau. */
export function puzzleInfo(over: Partial<DailyPuzzleInfo> = {}): DailyPuzzleInfo {
  return {
    date: "2026-11-12",
    puzzle: {
      id: 3,
      title: "Le coup du berger",
      description: "Un seul tour pour renverser la partie.",
      objective: { type: PuzzleObjectiveType.DESTROY_MONSTER, targetName: "Général Pipoulax" },
      rewardGold: 120,
      rewardXp: 80,
    },
    solved: false,
    streak: { current: 4, longest: 6, nextBoosterIn: 3 },
    nextResetAt: new Date(Date.now() + 7 * 3600_000).toISOString(),
    ...over,
  };
}
