import { TransactionStatus } from '@pipou/shared';
import type { SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '../transaction.entity';
import { applySalesFilter, salesFilterWhere } from './sales-filter';

const status = TransactionStatus.COMPLETED;

/** QueryBuilder factice qui enregistre les conditions. */
function recordingQb() {
  const calls: [string, string, object?][] = [];
  const qb = {
    where(sql: string, params?: object) {
      calls.push(['where', sql, params]);
      return qb;
    },
    andWhere(sql: string, params?: object) {
      calls.push(['andWhere', sql, params]);
      return qb;
    },
  };
  return { qb: qb as unknown as SelectQueryBuilder<Transaction>, calls };
}

describe('salesFilterWhere', () => {
  it('keeps every completed sale without a player', () => {
    expect(salesFilterWhere({})).toEqual([{ status }]);
    expect(salesFilterWhere({ role: 'seller' })).toEqual([{ status }]);
  });

  it('filters on the seller or the buyer', () => {
    expect(salesFilterWhere({ userId: 4, role: 'seller' })).toEqual([
      { status, seller: { id: 4 } },
    ]);
    expect(salesFilterWhere({ userId: 4, role: 'buyer' })).toEqual([
      { status, buyer: { id: 4 } },
    ]);
  });

  it('matches both sides by default', () => {
    expect(salesFilterWhere({ userId: 4 })).toEqual([
      { status, seller: { id: 4 } },
      { status, buyer: { id: 4 } },
    ]);
  });
});

describe('applySalesFilter', () => {
  it('keeps every completed sale without a player', () => {
    const { qb, calls } = recordingQb();
    applySalesFilter(qb, {});
    expect(calls).toEqual([['where', 't.status = :status', { status }]]);
  });

  it.each([
    ['seller', 't.seller_id = :userId'],
    ['buyer', 't.buyer_id = :userId'],
    ['both', '(t.seller_id = :userId OR t.buyer_id = :userId)'],
  ] as const)('filters the %s side', (role, sql) => {
    const { qb, calls } = recordingQb();
    applySalesFilter(qb, { userId: 4, role });
    expect(calls[1]).toEqual(['andWhere', sql, { userId: 4 }]);
  });
});
