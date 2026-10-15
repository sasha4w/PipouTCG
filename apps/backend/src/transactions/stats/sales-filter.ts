import { TransactionStatus } from '@pipou/shared';
import type { SalesFilter } from '@pipou/shared';
import type { FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '../transaction.entity';

// Les deux fonctions traduisent le même filtre : ventes conclues, puis celles
// où le joueur est vendeur, acheteur ou l'un des deux. Sans joueur : tout le marché.

/** Pour les `find` du repository. */
export function salesFilterWhere({
  userId,
  role = 'both',
}: SalesFilter): FindOptionsWhere<Transaction>[] {
  const status = TransactionStatus.COMPLETED;
  if (!userId) return [{ status }];
  const asSeller = { status, seller: { id: userId } };
  const asBuyer = { status, buyer: { id: userId } };
  if (role === 'seller') return [asSeller];
  if (role === 'buyer') return [asBuyer];
  return [asSeller, asBuyer];
}

/** Pour les agrégats en QueryBuilder (alias de table `t`). */
export function applySalesFilter(
  qb: SelectQueryBuilder<Transaction>,
  { userId, role = 'both' }: SalesFilter,
): SelectQueryBuilder<Transaction> {
  qb.where('t.status = :status', { status: TransactionStatus.COMPLETED });
  if (!userId) return qb;
  if (role === 'seller')
    return qb.andWhere('t.seller_id = :userId', { userId });
  if (role === 'buyer') return qb.andWhere('t.buyer_id = :userId', { userId });
  return qb.andWhere('(t.seller_id = :userId OR t.buyer_id = :userId)', {
    userId,
  });
}
