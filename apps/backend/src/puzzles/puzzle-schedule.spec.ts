import { addDays, pickFallback, puzzleDay } from './puzzle-schedule';

describe('puzzle-schedule', () => {
  it('le jour de défi bascule à 4 h', () => {
    expect(puzzleDay(new Date(2026, 10, 12, 3, 59))).toBe('2026-11-11');
    expect(puzzleDay(new Date(2026, 10, 12, 4, 0))).toBe('2026-11-12');
  });

  it('addDays traverse les mois', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('repli : jamais joué d’abord, puis le plus ancien, puis le plus petit id', () => {
    expect(pickFallback([])).toBeNull();
    expect(
      pickFallback([
        { id: 1, lastPlayed: '2026-11-01' },
        { id: 2, lastPlayed: null },
      ]),
    ).toBe(2);
    expect(
      pickFallback([
        { id: 3, lastPlayed: '2026-11-05' },
        { id: 4, lastPlayed: '2026-11-02' },
      ]),
    ).toBe(4);
    expect(
      pickFallback([
        { id: 9, lastPlayed: null },
        { id: 5, lastPlayed: null },
      ]),
    ).toBe(5);
  });
});
