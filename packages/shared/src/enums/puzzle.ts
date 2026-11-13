// Valeurs stockées en base (daily_puzzle.objective_type / .status, daily_puzzle_schedule.origin).
export const PuzzleObjectiveType = {
  WIN_GAME: "WIN_GAME",
  DESTROY_MONSTER: "DESTROY_MONSTER",
  CLEAR_ENEMY_BOARD: "CLEAR_ENEMY_BOARD",
  TAKE_PRIMES: "TAKE_PRIMES",
} as const;
export type PuzzleObjectiveType =
  (typeof PuzzleObjectiveType)[keyof typeof PuzzleObjectiveType];

export const PuzzleStatus = { DRAFT: "draft", PUBLISHED: "published" } as const;
export type PuzzleStatus = (typeof PuzzleStatus)[keyof typeof PuzzleStatus];

export const PuzzleScheduleOrigin = { MANUAL: "manual", AUTO: "auto" } as const;
export type PuzzleScheduleOrigin =
  (typeof PuzzleScheduleOrigin)[keyof typeof PuzzleScheduleOrigin];
