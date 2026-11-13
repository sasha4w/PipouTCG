import { addDays } from './puzzle-schedule';
import { computeStreak, earnsBooster } from './puzzle-streak';

const today = '2026-11-12';

describe('puzzle-streak', () => {
  it('aucune résolution', () =>
    expect(computeStreak([], today)).toEqual({
      current: 0,
      longest: 0,
      nextBoosterIn: 7,
    }));

  it('série en cours jusqu’à aujourd’hui', () =>
    expect(
      computeStreak(['2026-11-10', '2026-11-11', '2026-11-12'], today),
    ).toEqual({ current: 3, longest: 3, nextBoosterIn: 4 }));

  it('pas encore joué aujourd’hui : la série d’hier tient', () =>
    expect(computeStreak(['2026-11-10', '2026-11-11'], today).current).toBe(2));

  it('un jour manqué remet à zéro mais garde le record', () =>
    expect(
      computeStreak(
        ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10'],
        today,
      ),
    ).toEqual({ current: 0, longest: 3, nextBoosterIn: 7 }));

  it('booster tous les 7 jours', () => {
    expect(earnsBooster(7)).toBe(true);
    expect(earnsBooster(14)).toBe(true);
    expect(earnsBooster(8)).toBe(false);
    expect(earnsBooster(0)).toBe(false);
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
    expect(computeStreak(week, today).nextBoosterIn).toBe(7);
  });
});
