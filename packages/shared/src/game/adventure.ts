/** Nombre d'adversaires par monde (le dernier est le boss). */
export const ADVENTURE_OPPONENTS_PER_WORLD = 5;
export const ADVENTURE_BOSS_LEVEL = 5;
/** Plafond par défaut de récompenses de farm par jour. */
export const ADVENTURE_DAILY_CAP_DEFAULT = 20;

export interface AdventureRewardConfig {
  firstWinGold: number;
  firstWinXp: number;
  farmGold: number;
  farmXp: number;
  /** Pourcentage (0-100) de chance de booster en farm. */
  farmBoosterPct: number;
  /** Pourcentage (0-100) de chance de carte légendaire en farm. */
  farmLegendaryPct: number;
}

export const ADVENTURE_LEVEL_DEFAULTS: Record<1 | 2 | 3 | 4 | 5, AdventureRewardConfig> = {
  1: { firstWinGold: 100, firstWinXp: 50, farmGold: 15, farmXp: 10, farmBoosterPct: 3, farmLegendaryPct: 0 },
  2: { firstWinGold: 150, firstWinXp: 80, farmGold: 20, farmXp: 15, farmBoosterPct: 4, farmLegendaryPct: 0 },
  3: { firstWinGold: 200, firstWinXp: 120, farmGold: 30, farmXp: 20, farmBoosterPct: 5, farmLegendaryPct: 0 },
  4: { firstWinGold: 300, firstWinXp: 180, farmGold: 40, farmXp: 30, farmBoosterPct: 7, farmLegendaryPct: 0 },
  5: { firstWinGold: 500, firstWinXp: 300, farmGold: 60, farmXp: 40, farmBoosterPct: 10, farmLegendaryPct: 2 },
};

/** Signature de jeu de l'IA d'un monde. */
export type AdventureArchetype = "pipou" | "pixelman" | "dragon";
