import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DUST_VALUE } from '@pipou/shared';
import type {
  DestroyBatchRequest,
  DestroyBatchResponse,
  DestroyRequest,
  DestroyResponse,
  ForgeRequest,
  ForgeResponse,
  UsableCard,
} from '@pipou/shared';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { Card } from '../cards/card.entity';
import { ForgeCardInfo, ForgeInputCheck, validateForge } from './forge-rules';

/**
 * Copies protégées par UserCard : max(verrou, plus grande quantité utilisée
 * dans un seul deck). Un max, pas une somme : le verrou et un deck peuvent
 * protéger les mêmes copies.
 */
const PROTECTED_SQL = `
  SELECT uc.id AS user_card_id,
    GREATEST(uc.locked_quantity, COALESCE(MAX(dc.quantity), 0)) AS protected_qty
  FROM user_card uc
  LEFT JOIN deck_card dc ON dc.user_card_id = uc.id
  WHERE uc.user_id = ?
  GROUP BY uc.id, uc.locked_quantity`;

interface ProtectedRow {
  user_card_id: number;
  protected_qty: string | number;
}

/** UserCard verrouillé : la relation card est réduite à son id (loadRelationIds). */
type LockedUserCard = Omit<UserCard, 'card'> & { card: number };

const toInfo = (card: Card): ForgeCardInfo => ({
  id: card.id,
  rarity: card.rarity,
  setId: card.cardSet?.id ?? null,
  effects: card.effects,
});

@Injectable()
export class ForgeService {
  constructor(
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  async listUsable(userId: number): Promise<UsableCard[]> {
    const [owned, protectedMap] = await Promise.all([
      this.dataSource.getRepository(UserCard).find({
        where: { user: { id: userId } },
        relations: { card: true },
        order: { id: 'ASC' },
      }),
      this.protectedQuantities(this.dataSource, userId),
    ]);
    return owned
      .filter((uc) => uc.quantity > 0)
      .map((uc) => ({
        cardId: uc.card.id,
        owned: uc.quantity,
        usable: Math.max(0, uc.quantity - (protectedMap.get(uc.id) ?? 0)),
        lockedQuantity: uc.lockedQuantity ?? 0,
      }));
  }

  async forge(userId: number, req: ForgeRequest): Promise<ForgeResponse> {
    const result = await this.dataSource.transaction(async (manager) => {
      const inputIds = [...new Set(req.inputs.map((i) => i.cardId))];
      const owned = await this.lockUserCards(manager, userId, inputIds);
      const protectedMap = await this.protectedQuantities(manager, userId);
      const cards = await this.loadCards(manager, [
        ...inputIds,
        req.targetCardId,
      ]);

      const target = cards.get(req.targetCardId);
      if (!target) throw new BadRequestException('Carte visée introuvable');

      const usableOf = (cardId: number) => {
        const uc = owned.get(cardId);
        return uc
          ? Math.max(0, uc.quantity - (protectedMap.get(uc.id) ?? 0))
          : 0;
      };

      const checks: ForgeInputCheck[] = [];
      for (const input of req.inputs) {
        const card = cards.get(input.cardId);
        if (!card) throw new BadRequestException('Carte introuvable');
        checks.push({
          card: toInfo(card),
          quantity: input.quantity,
          usable: usableOf(input.cardId),
        });
      }

      const error = validateForge(checks, toInfo(target));
      if (error) throw new BadRequestException(error);

      for (const input of req.inputs) {
        const uc = owned.get(input.cardId)!;
        uc.quantity -= input.quantity;
        uc.lockedQuantity = Math.min(uc.lockedQuantity ?? 0, uc.quantity);
      }
      await manager.save([...owned.values()] as unknown as UserCard[]);

      let targetCard = await manager.findOne(UserCard, {
        where: { user: { id: userId }, card: { id: req.targetCardId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (targetCard) {
        targetCard.quantity += 1;
      } else {
        targetCard = manager.create(UserCard, {
          user: { id: userId },
          card: { id: req.targetCardId },
          quantity: 1,
        });
      }
      await manager.save(targetCard);

      await manager.increment(User, { id: userId }, 'cardsForged', 1);
      const user = await manager.findOne(User, { where: { id: userId } });

      return { dust: Number(user?.dust ?? 0), setId: target.cardSet?.id };
    });

    this.eventEmitter.emit('forge.done', { userId, amount: 1 });
    if (result.setId) {
      this.eventEmitter.emit('card.set.check', {
        userId,
        setId: result.setId,
      });
    }
    return { targetCardId: req.targetCardId, dust: result.dust };
  }

  async destroy(userId: number, req: DestroyRequest): Promise<DestroyResponse> {
    const { dustGained, dust } = await this.destroyBatch(userId, {
      items: [req],
    });
    return { dustGained, dust };
  }

  async destroyBatch(
    userId: number,
    req: DestroyBatchRequest,
  ): Promise<DestroyBatchResponse> {
    const cardIds = req.items.map((i) => i.cardId);
    if (new Set(cardIds).size !== cardIds.length) {
      throw new BadRequestException('Carte en double dans la destruction');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const owned = await this.lockUserCards(manager, userId, cardIds);
      const protectedMap = await this.protectedQuantities(manager, userId);
      const cards = await this.loadCards(manager, cardIds);

      let dustGained = 0;
      let destroyed = 0;
      for (const item of req.items) {
        const card = cards.get(item.cardId);
        const uc = owned.get(item.cardId);
        if (!card || !uc) throw new BadRequestException('Carte introuvable');

        const usable = Math.max(
          0,
          uc.quantity - (protectedMap.get(uc.id) ?? 0),
        );
        if (item.quantity > usable) {
          throw new BadRequestException(
            "Tu ne possèdes pas assez d'exemplaires disponibles",
          );
        }
        dustGained += DUST_VALUE[card.rarity] * item.quantity;
        destroyed += item.quantity;
      }

      for (const item of req.items) {
        const uc = owned.get(item.cardId)!;
        uc.quantity -= item.quantity;
        uc.lockedQuantity = Math.min(uc.lockedQuantity ?? 0, uc.quantity);
      }
      await manager.save([...owned.values()] as unknown as UserCard[]);

      await manager.increment(User, { id: userId }, 'dust', dustGained);
      await manager.increment(User, { id: userId }, 'dustEarned', dustGained);
      await manager.increment(
        User,
        { id: userId },
        'cardsDestroyed',
        destroyed,
      );
      const user = await manager.findOne(User, { where: { id: userId } });

      return { dustGained, dust: Number(user?.dust ?? 0), destroyed };
    });

    this.eventEmitter.emit('destroy.done', {
      userId,
      amount: result.destroyed,
    });
    return result;
  }

  /** Verrouille les UserCard du joueur (ordre d'id croissant), indexés par card id. */
  private async lockUserCards(
    manager: EntityManager,
    userId: number,
    cardIds: number[],
  ): Promise<Map<number, LockedUserCard>> {
    const rows = (await manager.find(UserCard, {
      where: { user: { id: userId }, card: { id: In(cardIds) } },
      order: { id: 'ASC' },
      loadRelationIds: { relations: ['card'] },
      lock: { mode: 'pessimistic_write' },
    })) as unknown as LockedUserCard[];
    return new Map(rows.map((uc) => [uc.card, uc]));
  }

  private async loadCards(manager: EntityManager, ids: number[]) {
    const cards = await manager.find(Card, {
      where: { id: In([...new Set(ids)]) },
      relations: { cardSet: true },
    });
    return new Map(cards.map((c) => [c.id, c]));
  }

  private async protectedQuantities(
    runner: Pick<EntityManager, 'query'>,
    userId: number,
  ): Promise<Map<number, number>> {
    const rows: ProtectedRow[] = await runner.query(PROTECTED_SQL, [userId]);
    return new Map(
      rows.map((r) => [Number(r.user_card_id), Number(r.protected_qty)]),
    );
  }
}
