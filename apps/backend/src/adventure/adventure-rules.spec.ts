import type { AdventureRewardConfig } from '@pipou/shared';
import { RESET_HOUR } from '../quests/quest-schedule';
import {
  canActivateWorld,
  countsAsPlayed,
  farmWindowStart,
  isWorldUnlocked,
  opponentStates,
  rollLoot,
} from './adventure-rules';

const cfg: AdventureRewardConfig = {
  firstWinGold: 100,
  firstWinXp: 50,
  farmGold: 15,
  farmXp: 10,
  farmBoosterPct: 3,
  farmLegendaryPct: 2,
};

const base = {
  firstWin: false,
  isBoss: false,
  config: cfg,
  farmRewardsToday: 0,
  dailyCap: 20,
  random: () => 0.5,
};

describe('opponentStates', () => {
  it('ouvre seulement le premier adversaire', () => {
    expect(opponentStates(new Set())).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });
  it("débloque le suivant d'une position battue", () => {
    expect(opponentStates(new Set([1, 2]))).toEqual([
      'beaten',
      'beaten',
      'available',
      'locked',
      'locked',
    ]);
  });
});

describe('isWorldUnlocked', () => {
  it('sans prérequis -> débloqué', () => {
    expect(isWorldUnlocked({ prerequisiteIds: [] }, new Set())).toBe(true);
  });
  it('tous les prérequis requis', () => {
    expect(isWorldUnlocked({ prerequisiteIds: [1, 2] }, new Set([1]))).toBe(
      false,
    );
    expect(
      isWorldUnlocked({ prerequisiteIds: [1, 2] }, new Set([1, 2, 3])),
    ).toBe(true);
  });
});

describe('canActivateWorld', () => {
  it('refuse sans booster', () => {
    expect(canActivateWorld({ boosterId: null, legendaryCount: 1 })).toEqual({
      ok: false,
      reason: 'Aucun booster de récompense',
    });
  });
  it('refuse sans légendaire', () => {
    expect(canActivateWorld({ boosterId: 1, legendaryCount: 0 })).toEqual({
      ok: false,
      reason: 'Aucune carte légendaire dans le set',
    });
  });
  it('accepte sinon', () => {
    expect(canActivateWorld({ boosterId: 1, legendaryCount: 1 })).toEqual({
      ok: true,
    });
  });
});

describe('farmWindowStart', () => {
  it('03:59 -> veille à RESET_HOUR', () => {
    const r = farmWindowStart(new Date(2026, 9, 18, RESET_HOUR - 1, 59));
    expect(r).toEqual(new Date(2026, 9, 17, RESET_HOUR, 0, 0, 0));
  });
  it('à RESET_HOUR pile -> le jour même', () => {
    const r = farmWindowStart(new Date(2026, 9, 18, RESET_HOUR, 0, 0, 0));
    expect(r).toEqual(new Date(2026, 9, 18, RESET_HOUR, 0, 0, 0));
  });
});

describe('rollLoot', () => {
  it('1re victoire non-boss : paie, booster, pas de légendaire, même plafond atteint', () => {
    expect(rollLoot({ ...base, firstWin: true, farmRewardsToday: 20 })).toEqual(
      { gold: 100, xp: 50, booster: true, legendary: false, capped: false },
    );
  });
  it('1re victoire boss : légendaire', () => {
    expect(rollLoot({ ...base, firstWin: true, isBoss: true }).legendary).toBe(
      true,
    );
  });
  it('farm : booster si random*100 < pct', () => {
    expect(rollLoot({ ...base, random: () => 0.001 }).booster).toBe(true);
    expect(rollLoot({ ...base, random: () => 0.5 }).booster).toBe(false);
  });
  it('farm : pct 0 jamais, pct 100 toujours', () => {
    const zero = { ...cfg, farmBoosterPct: 0 };
    const full = { ...cfg, farmBoosterPct: 100 };
    expect(rollLoot({ ...base, config: zero, random: () => 0 }).booster).toBe(
      false,
    );
    expect(
      rollLoot({ ...base, config: full, random: () => 0.999 }).booster,
    ).toBe(true);
  });
  it('farm : légendaire jamais pour non-boss, tiré pour le boss', () => {
    expect(rollLoot({ ...base, random: () => 0 }).legendary).toBe(false);
    expect(rollLoot({ ...base, isBoss: true, random: () => 0 }).legendary).toBe(
      true,
    );
    expect(
      rollLoot({ ...base, isBoss: true, random: () => 0.5 }).legendary,
    ).toBe(false);
  });
  it('farm : un random() par jet, booster puis légendaire', () => {
    const seq = [0.5, 0.001];
    const random = jest.fn(() => seq.shift() ?? 0.99);
    const r = rollLoot({ ...base, isBoss: true, random });
    expect(r.booster).toBe(false);
    expect(r.legendary).toBe(true);
    expect(random).toHaveBeenCalledTimes(2);
  });
  it('farm payé', () => {
    expect(rollLoot({ ...base, farmRewardsToday: 19 })).toMatchObject({
      gold: 15,
      xp: 10,
      capped: false,
    });
  });
  it('plafond atteint -> tout à zéro', () => {
    expect(rollLoot({ ...base, farmRewardsToday: 20 })).toEqual({
      gold: 0,
      xp: 0,
      booster: false,
      legendary: false,
      capped: true,
    });
  });
});

describe('countsAsPlayed', () => {
  it('victoire : toujours jouée ; défaite : à partir de 2 tours', () => {
    expect(countsAsPlayed(true, 0)).toBe(true);
    expect(countsAsPlayed(false, 0)).toBe(false);
    expect(countsAsPlayed(false, 1)).toBe(false);
    expect(countsAsPlayed(false, 2)).toBe(true);
  });
});
