import {
  drawDistinct,
  isRerollAvailable,
  lastDailyReset,
  nextDailyReset,
  nextWeeklyReset,
} from './quest-schedule';

// Dates locales (le serveur raisonne en heure locale, comme computeNextReset).
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

describe('resets', () => {
  it('reset daily : 4h du jour si passé, sinon 4h de la veille', () => {
    expect(lastDailyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 18, 4));
    expect(lastDailyReset(at(2026, 10, 18, 2))).toEqual(at(2026, 10, 17, 4));
    expect(nextDailyReset(at(2026, 10, 18, 2))).toEqual(at(2026, 10, 18, 4));
    expect(nextDailyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 19, 4));
  });

  it('reset hebdo : prochain lundi 4h', () => {
    // 18/10/2026 est un dimanche
    expect(nextWeeklyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 19, 4));
    expect(nextWeeklyReset(at(2026, 10, 19, 3))).toEqual(at(2026, 10, 19, 4));
    expect(nextWeeklyReset(at(2026, 10, 19, 5))).toEqual(at(2026, 10, 26, 4));
  });

  it('relance disponible une fois par journée de jeu', () => {
    const now = at(2026, 10, 18, 10);
    expect(isRerollAvailable(null, now)).toBe(true);
    expect(isRerollAvailable(at(2026, 10, 18, 5), now)).toBe(false);
    expect(isRerollAvailable(at(2026, 10, 18, 3), now)).toBe(true);
  });
});

describe('drawDistinct', () => {
  it('tire n éléments distincts', () => {
    const drawn = drawDistinct([1, 2, 3, 4, 5, 6], 3);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
  });

  it('rend tout le pool s’il est plus petit que n', () => {
    expect(drawDistinct([1, 2], 3).sort()).toEqual([1, 2]);
  });

  it('est déterministe avec un rng injecté', () => {
    expect(drawDistinct(['a', 'b', 'c'], 1, () => 0)).toEqual(['a']);
  });
});
