import {
  ADVENTURE_OPPONENTS_PER_WORLD,
  type AdventureOpponentState,
  type AdventureRewardConfig,
} from '@pipou/shared';
import { lastDailyReset } from '../quests/quest-schedule';

/** Index 0 = position 1 ; la position n est jouable si n-1 est battue. */
export function opponentStates(
  positionsBeaten: Set<number>,
): AdventureOpponentState[] {
  return Array.from({ length: ADVENTURE_OPPONENTS_PER_WORLD }, (_, i) => {
    const position = i + 1;
    if (positionsBeaten.has(position)) return 'beaten';
    if (position === 1 || positionsBeaten.has(position - 1)) return 'available';
    return 'locked';
  });
}

export function isWorldUnlocked(
  world: { prerequisiteIds: number[] },
  completedWorldIds: Set<number>,
): boolean {
  return world.prerequisiteIds.every((id) => completedWorldIds.has(id));
}

export function canActivateWorld(input: {
  boosterId: number | null;
  legendaryCount: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.boosterId === null) {
    return { ok: false, reason: 'Aucun booster de récompense' };
  }
  if (input.legendaryCount < 1) {
    return { ok: false, reason: 'Aucune carte légendaire dans le set' };
  }
  return { ok: true };
}

/** Tours minimum pour qu'une défaite PvE compte comme « jouée ». */
export const ADVENTURE_MIN_PLAYED_TURNS = 2;

/**
 * Un combat PvE terminé compte comme joué (quêtes, succès) s'il est gagné
 * ou s'il a duré au moins 2 tours : un abandon immédiat ne compte pas.
 * À garder aligné avec le SQL de `AchievementStatsService`.
 */
export function countsAsPlayed(won: boolean, turns: number): boolean {
  return won || turns >= ADVENTURE_MIN_PLAYED_TURNS;
}

/** Début de la fenêtre de farm courante (même reset que les quêtes daily). */
export function farmWindowStart(now: Date): Date {
  return lastDailyReset(now);
}

export interface AdventureLoot {
  gold: number;
  xp: number;
  booster: boolean;
  legendary: boolean;
  capped: boolean;
}

/**
 * Récompense d'une victoire. Pourcentages 0..100 : un jet réussit si
 * `random() * 100 < pct`. Ordre des appels à `random` en farm : booster,
 * puis légendaire (boss uniquement ; aucun appel sinon).
 * La 1re victoire paie toujours (booster garanti, légendaire si boss) et
 * ne consomme pas le plafond ; le farm est plafonné à `dailyCap`.
 */
export function rollLoot(input: {
  firstWin: boolean;
  isBoss: boolean;
  config: AdventureRewardConfig;
  farmRewardsToday: number;
  dailyCap: number;
  random: () => number;
}): AdventureLoot {
  const { firstWin, isBoss, config, farmRewardsToday, dailyCap, random } =
    input;
  if (firstWin) {
    return {
      gold: config.firstWinGold,
      xp: config.firstWinXp,
      booster: true,
      legendary: isBoss,
      capped: false,
    };
  }
  if (farmRewardsToday >= dailyCap) {
    return { gold: 0, xp: 0, booster: false, legendary: false, capped: true };
  }
  const booster = random() * 100 < config.farmBoosterPct;
  const legendary = isBoss && random() * 100 < config.farmLegendaryPct;
  return {
    gold: config.farmGold,
    xp: config.farmXp,
    booster,
    legendary,
    capped: false,
  };
}
