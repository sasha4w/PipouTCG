import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  PuzzleObjectiveType,
  PuzzleScheduleOrigin,
  PuzzleStatus,
} from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import type { UsersService } from '../users/users.service';
import { DailyPuzzle } from './daily-puzzle.entity';
import { DailyPuzzleSchedule } from './daily-puzzle-schedule.entity';
import { UserPuzzleSolve } from './user-puzzle-solve.entity';
import { PuzzlesService } from './puzzles.service';
import { puzzleDay } from './puzzle-schedule';

const NOW = new Date();
const TODAY = puzzleDay(NOW);

function fakePuzzle(over: Partial<DailyPuzzle> = {}): DailyPuzzle {
  return {
    id: 3,
    title: 'Défi',
    description: null,
    state: { secret: 'plateau' },
    objectiveType: PuzzleObjectiveType.WIN_GAME,
    objectiveParams: {},
    seed: 1,
    rewardGold: 100,
    rewardXp: 50,
    status: PuzzleStatus.PUBLISHED,
    verifiedAt: new Date(),
    ...over,
  } as DailyPuzzle;
}

function setup(
  opts: {
    planned?: DailyPuzzle | null;
    solvedDays?: string[];
    fresh?: boolean;
  } = {},
) {
  const planned = opts.planned ?? null;
  const insertSchedule = jest.fn().mockResolvedValue(undefined);
  const scheduleQb = {
    insert: () => scheduleQb,
    values: (v: unknown) => {
      insertSchedule(v);
      return scheduleQb;
    },
    orIgnore: () => scheduleQb,
    execute: () => Promise.resolve({}),
  };
  const schedule = {
    findOne: jest
      .fn()
      .mockResolvedValue(planned ? { date: TODAY, puzzle: planned } : null),
    createQueryBuilder: () => scheduleQb,
  };
  const solvedDays = opts.solvedDays ?? [];
  const solves = {
    find: jest.fn().mockResolvedValue(solvedDays.map((date) => ({ date }))),
    exists: jest.fn().mockResolvedValue(solvedDays.includes(TODAY)),
  };
  const m = {
    createQueryBuilder: () => {
      const qb = {
        insert: () => qb,
        into: () => qb,
        values: () => qb,
        orIgnore: () => qb,
        execute: () =>
          Promise.resolve({
            raw: { affectedRows: opts.fresh === false ? 0 : 1 },
          }),
      };
      return qb;
    },
    find: jest
      .fn()
      .mockResolvedValue([...solvedDays, TODAY].map((date) => ({ date }))),
  };
  const dataSource = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn((fn: (mm: typeof m) => Promise<unknown>) => fn(m)),
  };
  const users = {
    addGold: jest.fn().mockResolvedValue(undefined),
    addExperience: jest.fn().mockResolvedValue(undefined),
    addBoosterToUser: jest.fn().mockResolvedValue(undefined),
  };
  const events = { emit: jest.fn() };
  const service = new PuzzlesService(
    {} as Repository<DailyPuzzle>,
    schedule as unknown as Repository<DailyPuzzleSchedule>,
    solves as unknown as Repository<UserPuzzleSolve>,
    {} as Repository<Card>,
    users as unknown as UsersService,
    dataSource as unknown as DataSource,
    events as unknown as EventEmitter2,
  );
  return { service, schedule, insertSchedule, dataSource, users, events, m };
}

describe('PuzzlesService', () => {
  it('today : renvoie le défi programmé', async () => {
    const { service, insertSchedule } = setup({ planned: fakePuzzle() });
    const r = await service.today(NOW);
    expect(r).toEqual({
      date: TODAY,
      puzzle: expect.objectContaining({ id: 3 }) as DailyPuzzle,
    });
    expect(insertSchedule).not.toHaveBeenCalled();
  });

  it('today : sans programmation, inscrit le repli le moins récemment joué (origin auto)', async () => {
    const { service, schedule, dataSource, insertSchedule } = setup();
    dataSource.query.mockResolvedValue([
      { id: 1, lastPlayed: '2026-01-05' },
      { id: 2, lastPlayed: null },
    ]);
    schedule.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ date: TODAY, puzzle: fakePuzzle({ id: 2 }) });
    const r = await service.today(NOW);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('verified_at IS NOT NULL'),
      [PuzzleStatus.PUBLISHED],
    );
    expect(insertSchedule).toHaveBeenCalledWith({
      date: TODAY,
      puzzleId: 2,
      origin: PuzzleScheduleOrigin.AUTO,
    });
    expect(r.puzzle?.id).toBe(2);
  });

  it('today : aucun défi publié → puzzle null, rien d’écrit', async () => {
    const { service, insertSchedule } = setup();
    const r = await service.today(NOW);
    expect(r.puzzle).toBeNull();
    expect(insertSchedule).not.toHaveBeenCalled();
  });

  it('getToday : n’expose jamais state', async () => {
    const { service } = setup({ planned: fakePuzzle() });
    const info = await service.getToday(7);
    expect(info.puzzle?.id).toBe(3);
    expect(JSON.stringify(info)).not.toContain('"state"');
    expect(JSON.stringify(info)).not.toContain('plateau');
  });

  it('completeToday : première résolution verse or + XP et émet puzzle.solved', async () => {
    const { service, users, events, m } = setup({ planned: fakePuzzle() });
    const r = await service.completeToday(7, 3);
    expect(r).toMatchObject({
      firstSolve: true,
      gold: 100,
      xp: 50,
      booster: false,
    });
    expect(users.addGold).toHaveBeenCalledWith(7, 100, m);
    expect(users.addExperience).toHaveBeenCalledWith(7, 50, m);
    expect(users.addBoosterToUser).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('puzzle.solved', {
      userId: 7,
      date: TODAY,
    });
  });

  it('completeToday : déjà résolu aujourd’hui → firstSolve false, rien de versé, rien d’émis', async () => {
    const { service, users, events } = setup({
      planned: fakePuzzle(),
      fresh: false,
    });
    const r = await service.completeToday(7, 3);
    expect(r).toMatchObject({
      firstSolve: false,
      gold: 0,
      xp: 0,
      booster: false,
    });
    expect(users.addGold).not.toHaveBeenCalled();
    expect(users.addExperience).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('completeToday : 7e jour de série → booster', async () => {
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - (i + 1));
      return puzzleDay(d);
    });
    const { service, users, m } = setup({
      planned: fakePuzzle(),
      solvedDays: days,
    });
    const r = await service.completeToday(7, 3);
    expect(r.booster).toBe(true);
    expect(users.addBoosterToUser).toHaveBeenCalledWith(
      7,
      ACHIEVEMENT_REWARD_BOOSTER_ID,
      1,
      m,
    );
  });

  it('completeToday : refuse un défi qui n’est pas celui du jour', async () => {
    const { service, users } = setup({ planned: fakePuzzle() });
    await expect(service.completeToday(7, 99)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.addGold).not.toHaveBeenCalled();
  });
});
