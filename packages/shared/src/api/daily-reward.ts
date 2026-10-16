import type { DailyRewardType } from "../enums/reward";

/** Récompense telle que définie en BDD (jour du cycle ou palier). */
export interface DailyRewardItem {
  type: DailyRewardType;
  /** Gold par unité, ou id de la carte / du booster / du bundle. */
  value: number;
  quantity: number;
  /** Label admin, sans emoji. */
  label: string | null;
}

/** Récompense distribuée lors d'un claim. */
export interface DailyRewardGain extends DailyRewardItem {
  isMilestone: boolean;
}

/** Palier de fidélité : versé quand le streak atteint exactement dayThreshold. */
export interface DailyRewardMilestone extends DailyRewardItem {
  dayThreshold: number;
}

export interface StreakView {
  current: number;
  longest: number;
  /** Cumul all-time, jamais remis à zéro (stats uniquement). */
  totalDays: number;
  /** YYYY-MM-DD (UTC). */
  lastClaimDate: string | null;
}

/** GET /daily-reward/status */
export interface DailyRewardStatus {
  streak: StreakView;
  /** Position du prochain jour à réclamer. */
  nextDay: { cycleDay: number; weekNumber: number };
  alreadyClaimed: boolean;
  /** Exactement 1 jour manqué : rachat possible aujourd'hui. */
  rescueAvailable: boolean;
  rescueCost: number | null;
  /** 2 jours manqués ou plus : le prochain claim remet la série à zéro. */
  streakAtRisk: boolean;
  nextReward: DailyRewardItem | null;
  /** Paliers actifs, triés par seuil croissant. */
  milestones: DailyRewardMilestone[];
  /** YYYY-MM-DD (UTC) réclamés depuis min(1er du mois, J-6). */
  claimedDates: string[];
  /** YYYY-MM-DD (UTC) rachetés sur la même période. */
  rescuedDates: string[];
}

export interface ClaimedDailyResult {
  status: "claimed";
  message: string;
  streak: StreakView;
  rewards: DailyRewardGain[];
  /** Longueur de la série perdue juste avant ce claim. */
  streakLost?: number;
}

/** POST /daily-reward/claim */
export type ClaimDailyResult =
  | ClaimedDailyResult
  | {
      status: "rescue_required";
      message: string;
      streak: StreakView;
      rescue: { cost: number };
    };

/** POST /daily-reward/rescue */
export interface RescueStreakResult {
  message: string;
  goldSpent: number;
  goldRemaining: number;
  streak: number;
}

/** Emoji (Extended_Pictographic) suivi d'un éventuel VS16 (U+FE0F). */
const EMOJI = /\p{Extended_Pictographic}️?/gu;

/** Retire les emojis d'un label admin ; null si rien ne reste. */
export function stripEmoji(label: string | null | undefined): string | null {
  if (!label) return null;
  const cleaned = label.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}
