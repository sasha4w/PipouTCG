import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SalesFilter, SalesStats } from '@pipou/shared';
import { Transaction } from '../transaction.entity';
import { User } from '../../users/user.entity';
import { applySalesFilter } from './sales-filter';
import {
  avgUnitPrice,
  bestDay,
  bucketDaily,
  chartStart,
  toNullableNumber,
  toNumber,
  trend,
} from './sales-stats.calc';

type Raw = string | number | null;

interface RawTotals {
  count: Raw;
  totalGold: Raw;
  units: Raw;
  minUnit: Raw;
  maxUnit: Raw;
}

/** Stats des ventes conclues (tout le marché ou un joueur), pour GET /transactions/stats. */
@Injectable()
export class TransactionStatsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private sales(filter: SalesFilter) {
    return applySalesFilter(
      this.transactionRepository.createQueryBuilder('t'),
      filter,
    );
  }

  async getStats(filter: SalesFilter, now = new Date()): Promise<SalesStats> {
    const [totals, recent, biggest, topItem, topPartner] = await Promise.all([
      this.sales(filter)
        .select('COUNT(*)', 'count')
        .addSelect('SUM(t.totalPrice)', 'totalGold')
        .addSelect('SUM(t.quantity)', 'units')
        .addSelect('MIN(t.unitPrice)', 'minUnit')
        .addSelect('MAX(t.unitPrice)', 'maxUnit')
        .getRawOne<RawTotals>(),
      this.sales(filter)
        .andWhere('t.updatedAt >= :since', { since: chartStart(now) })
        .select(['t.id', 't.totalPrice', 't.updatedAt'])
        .getMany(),
      this.sales(filter)
        .orderBy('t.totalPrice', 'DESC')
        .addOrderBy('t.updatedAt', 'DESC')
        .limit(1)
        .getOne(),
      this.sales(filter)
        .select('t.itemName', 'itemName')
        .addSelect('SUM(t.quantity)', 'units')
        .groupBy('t.itemName')
        .orderBy('units', 'DESC')
        .limit(1)
        .getRawOne<{ itemName: string | null; units: Raw }>(),
      this.topPartner(filter),
    ]);

    const totalGold = toNumber(totals?.totalGold);
    const unitsTraded = toNumber(totals?.units);
    const daily = bucketDaily(
      recent.map((sale) => ({ date: sale.updatedAt, gold: sale.totalPrice })),
      now,
    );

    return {
      count: toNumber(totals?.count),
      totalGold,
      unitsTraded,
      avgUnitPrice: avgUnitPrice(totalGold, unitsTraded),
      minUnitPrice: toNullableNumber(totals?.minUnit),
      maxUnitPrice: toNullableNumber(totals?.maxUnit),
      biggestSale: biggest
        ? {
            id: biggest.id,
            itemName: biggest.itemName ?? `#${biggest.productId}`,
            totalPrice: biggest.totalPrice,
            quantity: biggest.quantity,
            date: biggest.updatedAt.toISOString(),
          }
        : null,
      topItem: topItem
        ? {
            itemName: topItem.itemName ?? '—',
            units: toNumber(topItem.units),
          }
        : null,
      topPartner,
      bestDay: bestDay(daily),
      trend: trend(daily),
      daily,
    };
  }

  /** Joueur avec qui `userId` a conclu le plus de ventes, dans le rôle filtré. */
  private async topPartner(
    filter: SalesFilter,
  ): Promise<SalesStats['topPartner']> {
    if (!filter.userId) return null;
    // Contrepartie : l'acheteur quand le joueur vend, le vendeur quand il achète
    const row = await this.sales(filter)
      .innerJoin(
        User,
        'p',
        'p.id = CASE WHEN t.seller_id = :userId THEN t.buyer_id ELSE t.seller_id END',
      )
      .select('p.id', 'userId')
      .addSelect('p.username', 'username')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.id')
      .addGroupBy('p.username')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne<{ userId: Raw; username: string; count: Raw }>();
    return row
      ? {
          userId: toNumber(row.userId),
          username: row.username,
          count: toNumber(row.count),
        }
      : null;
  }
}
