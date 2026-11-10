import type { Repository } from 'typeorm';
import type { GameRecord } from './game-record.entity';
import { GameRecordsService } from './game-records.service';

function row(over: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 3,
    matchId: 40,
    mode: 'pvp',
    player1Id: 1,
    player2Id: 2,
    winnerSeat: 'p1',
    endReason: 'primes',
    turns: 9,
    moves: 120,
    summary: {
      v: 1,
      mode: 'pvp',
      seats: {} as never,
      cards: { p1: {}, p2: {} },
    },
    trace: null,
    traceBytes: 4000,
    formatVersion: 1,
    startedAt: new Date('2026-11-10T10:00:00Z'),
    endedAt: new Date('2026-11-10T10:20:00Z'),
    ...over,
  } as GameRecord;
}

function setup() {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '1234' }),
    getOne: jest.fn(),
  };
  const repo = {
    insert: jest.fn().mockResolvedValue(undefined),
    findAndCount: jest.fn().mockResolvedValue([[row()], 1]),
    createQueryBuilder: jest.fn(() => qb),
  };
  const svc = new GameRecordsService(repo as unknown as Repository<GameRecord>);
  return { svc, repo, qb };
}

describe('GameRecordsService', () => {
  it('total des traces lu en nombre', async () => {
    await expect(setup().svc.totalTraceBytes()).resolves.toBe(1234);
  });

  it('liste paginée, filtrée par mode, sans le blob', async () => {
    const { svc, repo } = setup();

    const page = await svc.list({ mode: 'pvp', page: 2 });

    const options = (repo.findAndCount.mock.calls as unknown[][])[0][0] as {
      where: { mode: string };
      skip: number;
      take: number;
    };
    expect(options.where.mode).toBe('pvp');
    expect(options.skip).toBe(options.take);
    expect(page).toMatchObject({ total: 1, page: 2 });
    expect(page.items[0]).toMatchObject({
      id: 3,
      hasTrace: true,
      endedAt: '2026-11-10T10:20:00.000Z',
    });
    expect(page.items[0]).not.toHaveProperty('trace');
  });

  it('trace : le blob, ou null', async () => {
    const { svc, qb } = setup();
    qb.getOne.mockResolvedValueOnce(row({ trace: Buffer.from('br') }));
    await expect(svc.trace(3)).resolves.toEqual(Buffer.from('br'));
    qb.getOne.mockResolvedValueOnce(null);
    await expect(svc.trace(4)).resolves.toBeNull();
  });
});
