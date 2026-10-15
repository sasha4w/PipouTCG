import {
  CHART_DAYS,
  avgUnitPrice,
  bestDay,
  bucketDaily,
  chartStart,
  toNullableNumber,
  toNumber,
  trend,
} from './sales-stats.calc';

const NOW = new Date('2026-10-15T12:00:00.000Z');

/** Série de 30 jours dont les `golds` remplissent la fin (dernier = aujourd'hui). */
const dailyEndingWith = (golds: number[]) =>
  bucketDaily([], NOW).map((d, i) => ({
    ...d,
    gold: golds[i - (CHART_DAYS - golds.length)] ?? 0,
  }));

describe('sales-stats.calc', () => {
  describe('chartStart', () => {
    it('starts at UTC midnight 29 days ago', () => {
      expect(chartStart(NOW).toISOString()).toBe('2026-09-16T00:00:00.000Z');
    });
  });

  describe('bucketDaily', () => {
    it('returns 30 days from D-29 to today, filled with zeros', () => {
      const daily = bucketDaily([], NOW);
      expect(daily).toHaveLength(30);
      expect(daily[0]).toEqual({ date: '2026-09-16', gold: 0 });
      expect(daily[29]).toEqual({ date: '2026-10-15', gold: 0 });
    });

    it('sums sales of the same UTC day and ignores sales outside the window', () => {
      const daily = bucketDaily(
        [
          { date: new Date('2026-10-15T01:00:00.000Z'), gold: 100 },
          { date: new Date('2026-10-15T23:59:00.000Z'), gold: 50 },
          { date: new Date('2026-10-01T10:00:00.000Z'), gold: 30 },
          { date: new Date('2026-09-15T23:59:00.000Z'), gold: 999 },
        ],
        NOW,
      );
      expect(daily[29].gold).toBe(150);
      expect(daily.find((d) => d.date === '2026-10-01')?.gold).toBe(30);
      expect(daily.reduce((s, d) => s + d.gold, 0)).toBe(180);
    });
  });

  describe('bestDay', () => {
    it('returns the richest day', () => {
      const daily = dailyEndingWith([10, 80, 20]);
      expect(bestDay(daily)).toEqual({ date: '2026-10-14', gold: 80 });
    });

    it('returns null when nothing was traded', () => {
      expect(bestDay(bucketDaily([], NOW))).toBeNull();
    });
  });

  describe('trend', () => {
    it('compares the last 7 days with the 7 before', () => {
      const daily = dailyEndingWith([
        ...Array<number>(7).fill(10),
        ...Array<number>(7).fill(20),
      ]);
      expect(trend(daily)).toEqual({ last7: 140, previous7: 70, percent: 100 });
    });

    it('has no percent when the previous week is empty', () => {
      const daily = dailyEndingWith([5]);
      expect(trend(daily)).toEqual({ last7: 5, previous7: 0, percent: null });
    });

    it('rounds negative changes', () => {
      const daily = dailyEndingWith([
        ...Array<number>(7).fill(3),
        ...Array<number>(7).fill(1),
      ]);
      expect(trend(daily).percent).toBe(-67);
    });
  });

  describe('conversions', () => {
    it('reads MySQL BIGINT sums returned as strings', () => {
      expect(toNumber('1250')).toBe(1250);
      expect(toNumber(null)).toBe(0);
      expect(toNullableNumber(null)).toBeNull();
      expect(toNullableNumber('15')).toBe(15);
    });

    it('weights the average price by units', () => {
      // ×5 pour 750 G + ×1 pour 30 G → 780 / 6 = 130
      expect(avgUnitPrice(780, 6)).toBe(130);
      expect(avgUnitPrice(100, 3)).toBe(33);
      expect(avgUnitPrice(0, 0)).toBeNull();
    });
  });
});
