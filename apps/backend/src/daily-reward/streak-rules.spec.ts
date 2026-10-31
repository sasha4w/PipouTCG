import {
  classifyGap,
  cycleDayFor,
  daysBetween,
  gameDay,
  rescueCost,
  shiftDay,
  weekNumberFor,
} from './streak-rules';

describe('streak-rules', () => {
  it('gameDay bascule au reset des quêtes, pas à minuit', () => {
    expect(gameDay(new Date(2026, 9, 16, 3, 59))).toBe('2026-10-15');
    expect(gameDay(new Date(2026, 9, 16, 4, 0))).toBe('2026-10-16');
  });

  it('shiftDay passe les changements de mois', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-10-16', -6)).toBe('2026-10-10');
  });

  it('daysBetween est signé', () => {
    expect(daysBetween('2026-10-14', '2026-10-16')).toBe(2);
    expect(daysBetween('2026-10-16', '2026-10-14')).toBe(-2);
  });

  it.each([
    [null, 'first'],
    ['2026-10-16', 'claimed_today'],
    ['2026-10-15', 'consecutive'],
    ['2026-10-14', 'rescuable'],
    ['2026-10-13', 'lost'],
    ['2026-09-01', 'lost'],
  ] as const)('classifyGap(%s) → %s', (last, expected) => {
    expect(classifyGap(last, '2026-10-16')).toBe(expected);
  });

  it('rescueCost = 100 + 10 × streak', () => {
    expect(rescueCost(0)).toBe(100);
    expect(rescueCost(7)).toBe(170);
    expect(rescueCost(30)).toBe(400);
    expect(rescueCost(100)).toBe(1100);
  });

  it('semaine et cycle dérivent du jour de streak', () => {
    expect([1, 7, 8, 14, 15].map(weekNumberFor)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 7, 8, 14, 15].map(cycleDayFor)).toEqual([1, 7, 1, 7, 1]);
  });
});
