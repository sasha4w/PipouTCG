import { AchievementFamily } from '@pipou/shared';
import {
  toAchievementValues,
  type AchievementSources,
} from './achievement-values';

const base: AchievementSources = {
  user: {
    boostersOpened: 12,
    cardsBought: 3,
    cardsSold: 4,
    cardsForged: 3,
    cardsDestroyed: 8,
    moneyEarned: '2500',
    questsCompleted: 7,
  },
  level: 6,
  fights: { wins: 2, losses: 3, draws: 1 },
  longestStreak: 9,
  uniqueCards: 40,
  highRarity: 2,
  adventure: { worldsCompleted: 2, won: 5, played: 8 },
  sets: [
    { total: 10, owned: 10 },
    { total: 8, owned: 7 },
    { total: 0, owned: 0 },
  ],
};

describe('toAchievementValues', () => {
  it('mappe chaque famille sur sa source', () => {
    expect(toAchievementValues(base)).toEqual({
      [AchievementFamily.BOOSTERS_OPENED]: 12,
      [AchievementFamily.CARDS_BOUGHT]: 3,
      [AchievementFamily.CARDS_SOLD]: 4,
      [AchievementFamily.CARDS_FORGED]: 3,
      [AchievementFamily.CARDS_DESTROYED]: 8,
      [AchievementFamily.SETS_COMPLETED]: 1,
      [AchievementFamily.DUELS_WON]: 2,
      [AchievementFamily.DUELS_PLAYED]: 6,
      [AchievementFamily.LEVEL]: 6,
      [AchievementFamily.UNIQUE_CARDS]: 40,
      [AchievementFamily.HIGH_RARITY]: 2,
      [AchievementFamily.LOGIN_STREAK]: 9,
      [AchievementFamily.GOLD_EARNED]: 2500,
      [AchievementFamily.QUESTS_DONE]: 7,
      [AchievementFamily.ADVENTURE_WORLDS]: 2,
      [AchievementFamily.PVE_WON]: 5,
      [AchievementFamily.PVE_PLAYED]: 8,
    });
  });

  it('compte 0 sans stats de duel ni série', () => {
    const v = toAchievementValues({
      ...base,
      fights: null,
      longestStreak: null,
    });
    expect(v[AchievementFamily.DUELS_WON]).toBe(0);
    expect(v[AchievementFamily.DUELS_PLAYED]).toBe(0);
    expect(v[AchievementFamily.LOGIN_STREAK]).toBe(0);
  });

  it('ne compte pas un set vide comme complété', () => {
    const v = toAchievementValues({ ...base, sets: [{ total: 0, owned: 0 }] });
    expect(v[AchievementFamily.SETS_COMPLETED]).toBe(0);
  });
});
