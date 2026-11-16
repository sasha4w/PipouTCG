import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PuzzleScheduleDto } from './puzzle-schedule.dto';

const errorsFor = (date: string) =>
  validateSync(plainToInstance(PuzzleScheduleDto, { date, puzzleId: 1 }));

describe('PuzzleScheduleDto', () => {
  it('accepte une vraie date', () => {
    expect(errorsFor('2026-11-13')).toHaveLength(0);
    expect(errorsFor('2028-02-29')).toHaveLength(0);
  });

  it.each(['2026-13-45', '2026-02-30', '2027-02-29', '2026-00-10'])(
    'refuse la date impossible %s',
    (date) => {
      expect(errorsFor(date).length).toBeGreaterThan(0);
    },
  );
});
