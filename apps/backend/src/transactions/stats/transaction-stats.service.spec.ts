import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../transaction.entity';
import { TransactionStatsService } from './transaction-stats.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');

/** QueryBuilder factice : toute méthode chaînable renvoie le builder. */
function fakeQb(result: { raw?: unknown; many?: unknown[]; one?: unknown }) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'where',
    'andWhere',
    'select',
    'addSelect',
    'innerJoin',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ])
    qb[method] = jest.fn(() => qb);
  qb.getRawOne = jest.fn().mockResolvedValue(result.raw);
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  qb.getOne = jest.fn().mockResolvedValue(result.one ?? null);
  return qb;
}

const repo = { createQueryBuilder: jest.fn() };

/** Ordre de création des builders dans getStats : totaux, 30 jours, plus grosse vente, top objet, top partenaire. */
function stubQueries(results: Parameters<typeof fakeQb>[0][]) {
  const builders = results.map(fakeQb);
  builders.forEach((qb) => repo.createQueryBuilder.mockReturnValueOnce(qb));
  return builders;
}

const EMPTY_TOTALS = {
  count: '0',
  totalGold: null,
  units: null,
  minUnit: null,
  maxUnit: null,
};

describe('TransactionStatsService', () => {
  let service: TransactionStatsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionStatsService,
        { provide: getRepositoryToken(Transaction), useValue: repo },
      ],
    }).compile();
    service = module.get(TransactionStatsService);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns zeros and nulls for an empty history', async () => {
    stubQueries([{ raw: EMPTY_TOTALS }, {}, {}, { raw: undefined }]);

    const stats = await service.getStats({}, NOW);

    expect(stats).toEqual({
      count: 0,
      totalGold: 0,
      unitsTraded: 0,
      avgUnitPrice: null,
      minUnitPrice: null,
      maxUnitPrice: null,
      biggestSale: null,
      topItem: null,
      topPartner: null,
      bestDay: null,
      trend: { last7: 0, previous7: 0, percent: null },
      daily: expect.any(Array) as unknown[],
    });
    expect(stats.daily).toHaveLength(30);
    expect(stats.daily.every((d) => d.gold === 0)).toBe(true);
  });

  it('does not look for a partner on the whole market', async () => {
    stubQueries([{ raw: EMPTY_TOTALS }, {}, {}, {}]);
    await service.getStats({}, NOW);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(4);
  });

  it('assembles the stats of a player', async () => {
    const [, recent, biggest] = stubQueries([
      {
        raw: {
          count: '2',
          totalGold: '780',
          units: '6',
          minUnit: '30',
          maxUnit: '150',
        },
      },
      {
        many: [
          { totalPrice: 750, updatedAt: new Date('2026-10-14T09:00:00.000Z') },
          { totalPrice: 30, updatedAt: new Date('2026-10-15T09:00:00.000Z') },
        ],
      },
      {
        one: {
          id: 9,
          itemName: 'Brigade de Combat',
          productId: 3,
          totalPrice: 750,
          quantity: 5,
          updatedAt: new Date('2026-10-14T09:00:00.000Z'),
        },
      },
      { raw: { itemName: 'Brigade de Combat', units: '5' } },
      { raw: { userId: 2, username: 'phimocard', count: '2' } },
    ]);

    const stats = await service.getStats({ userId: 1, role: 'both' }, NOW);

    expect(stats).toMatchObject({
      count: 2,
      totalGold: 780,
      unitsTraded: 6,
      avgUnitPrice: 130,
      minUnitPrice: 30,
      maxUnitPrice: 150,
      biggestSale: {
        id: 9,
        itemName: 'Brigade de Combat',
        totalPrice: 750,
        quantity: 5,
        date: '2026-10-14T09:00:00.000Z',
      },
      topItem: { itemName: 'Brigade de Combat', units: 5 },
      topPartner: { userId: 2, username: 'phimocard', count: 2 },
      bestDay: { date: '2026-10-14', gold: 750 },
      trend: { last7: 780, previous7: 0, percent: null },
    });
    expect(biggest.limit).toHaveBeenCalledWith(1);
    expect(recent.andWhere).toHaveBeenCalledWith('t.updatedAt >= :since', {
      since: new Date('2026-09-16T00:00:00.000Z'),
    });
  });
});
