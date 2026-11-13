import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import {
  collectCardIds,
  deserializeGame,
} from '../sandbox/scenario-serializer';
import type { GameState } from '../fights/interfaces/game-state.interface';

jest.mock('../sandbox/scenario-serializer', () => ({
  collectCardIds: jest.fn(),
  deserializeGame: jest.fn(),
}));

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
    stored?: DailyPuzzle | null;
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
  const puzzlesRepo = {
    findOneBy: jest.fn().mockResolvedValue(opts.stored ?? null),
  };
  const cardsRepo = { findBy: jest.fn().mockResolvedValue([]) };
  const service = new PuzzlesService(
    puzzlesRepo as unknown as Repository<DailyPuzzle>,
    schedule as unknown as Repository<DailyPuzzleSchedule>,
    solves as unknown as Repository<UserPuzzleSolve>,
    cardsRepo as unknown as Repository<Card>,
    users as unknown as UsersService,
    dataSource as unknown as DataSource,
    events as unknown as EventEmitter2,
  );
  return {
    service,
    schedule,
    insertSchedule,
    dataSource,
    users,
    events,
    m,
    puzzlesRepo,
    cardsRepo,
  };
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

  it('today : défi programmé non publié ou non vérifié → ignoré, rien d’écrit', async () => {
    for (const over of [
      { status: PuzzleStatus.DRAFT },
      { verifiedAt: null },
    ] as Partial<DailyPuzzle>[]) {
      const { service, insertSchedule } = setup({
        planned: fakePuzzle(over),
      });
      const r = await service.today(NOW);
      expect(r.puzzle).toBeNull();
      expect(insertSchedule).not.toHaveBeenCalled();
    }
  });

  describe('objectiveView', () => {
    const withTarget = fakePuzzle({
      objectiveParams: { targetInstanceId: 'x1' },
    });
    const gameWith = (zone: unknown[]) =>
      ({ player2: { monsterZones: zone } }) as unknown as GameState;

    it('renseigne targetName quand le monstre est sur le terrain adverse', () => {
      const { service } = setup();
      const game = gameWith([
        null,
        { instanceId: 'x1', card: { baseCard: { name: 'Gobelin' } } },
      ]);
      expect(service.objectiveView(withTarget, game).targetName).toBe(
        'Gobelin',
      );
    });

    it('laisse targetName absent sans correspondance, zone vide ou sans game', () => {
      const { service } = setup();
      const other = gameWith([
        { instanceId: 'zz', card: { baseCard: { name: 'Autre' } } },
      ]);
      expect(service.objectiveView(withTarget, other).targetName).toBe(
        undefined,
      );
      expect(
        service.objectiveView(withTarget, gameWith([null, null])).targetName,
      ).toBe(undefined);
      expect(service.objectiveView(withTarget).targetName).toBe(undefined);
    });
  });

  describe('load', () => {
    it('lève NotFound si le défi n’existe pas', async () => {
      const { service } = setup();
      await expect(
        service.load(9, { userId: 7, username: 'a' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sièges : userId pour p1, -userId pour p2 (matchId -userId)', async () => {
      const stored = fakePuzzle();
      const { service } = setup({ stored });
      (collectCardIds as jest.Mock).mockReturnValue([]);
      const game = { marker: true };
      (deserializeGame as jest.Mock).mockReturnValue(game);
      const r = await service.load(3, { userId: 7, username: 'a' });
      expect(r.game).toBe(game);
      expect(deserializeGame).toHaveBeenCalledWith(
        stored.state,
        expect.any(Map),
        {
          matchId: -7,
          p1: { userId: 7, username: 'a', socketId: '' },
          p2: { userId: -7, username: 'Défi', socketId: '' },
        },
      );
    });
  });

  it('getToday : survit à une carte supprimée (load lève), targetName absent', async () => {
    const stored = fakePuzzle({ objectiveParams: { targetInstanceId: 'x1' } });
    const { service } = setup({ planned: stored, stored });
    (collectCardIds as jest.Mock).mockReturnValue([]);
    (deserializeGame as jest.Mock).mockImplementation(() => {
      throw new Error('carte 12 introuvable');
    });
    const info = await service.getToday(7);
    expect(info.puzzle?.id).toBe(3);
    expect(info.puzzle?.objective.targetName).toBeUndefined();
  });
});
