import type { PuzzleObjectiveType, PuzzleScheduleOrigin, PuzzleStatus } from "../enums/puzzle";

/** Objectif d'un défi. `targetInstanceId` : monstre posé à détruire ; `primes` : primes à prendre. */
export interface PuzzleObjective {
  type: PuzzleObjectiveType;
  targetInstanceId?: string;
  primes?: number;
}

/** Objectif tel qu'affiché : le nom de la cible est résolu par le serveur. */
export interface PuzzleObjectiveView extends PuzzleObjective {
  targetName?: string;
}

export interface PuzzleStreak {
  current: number;
  longest: number;
  /** Jours restants avant le prochain booster de série (1 à 7). */
  nextBoosterIn: number;
}

export interface DailyPuzzleSummary {
  id: number;
  title: string;
  description: string | null;
  objective: PuzzleObjectiveView;
  rewardGold: number;
  rewardXp: number;
}

/** GET /puzzles/today. `puzzle` null : aucun défi publié. Jamais l'état du plateau. */
export interface DailyPuzzleInfo {
  date: string;
  puzzle: DailyPuzzleSummary | null;
  solved: boolean;
  streak: PuzzleStreak;
  nextResetAt: string;
}

/** Ce que rapporte une résolution. `firstSolve` false : déjà résolu aujourd'hui, rien de versé. */
export interface PuzzleReward {
  firstSolve: boolean;
  gold: number;
  xp: number;
  booster: boolean;
  streak: PuzzleStreak;
}

export type PuzzleSolveStatus = "solved" | "not_found" | "timeout";

export interface PuzzleVerifyResult {
  status: PuzzleSolveStatus;
  /** Suite de coups lisible, quand une solution est trouvée. */
  solution: string[];
  nodes: number;
  ms: number;
}

export interface AdminPuzzle extends DailyPuzzleSummary {
  status: PuzzleStatus;
  seed: number;
  verifiedAt: string | null;
  createdBy: string;
  updatedAt: string;
  lastPlayed: string | null;
  /** Monstres adverses de l'état de départ, pour choisir la cible. */
  enemyMonsters: { instanceId: string; name: string }[];
}

export interface PuzzleSaveBody {
  title: string;
  description?: string;
  objective: PuzzleObjective;
  rewardGold?: number;
  rewardXp?: number;
}

export interface PuzzlePublishBody {
  /** « Je l'ai résolu moi-même » : publie sans solution trouvée par le solveur. */
  manualOverride?: boolean;
}

export interface PuzzleScheduleEntry {
  date: string;
  puzzleId: number | null;
  title: string | null;
  origin: PuzzleScheduleOrigin | null;
}

export interface PuzzleScheduleBody {
  date: string;
  /** null : libère la date (le repli automatique reprend la main). */
  puzzleId: number | null;
}
