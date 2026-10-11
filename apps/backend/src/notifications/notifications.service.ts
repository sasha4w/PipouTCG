import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  INBOX_PAGE_SIZE,
  NOTIFICATION_CATEGORY_OF,
  NotificationCategory,
  NotificationType,
  PATCHNOTE_VISIBLE_DAYS,
  READ_RETENTION_DAYS,
  isNotableDrop,
} from '@pipou/shared';
import type {
  CardDropEntry,
  CreatePatchnoteRequest,
  NotificationItem,
  NotificationPayloadMap,
  NotificationsResponse,
  QuestRewardType,
  UnreadCounts,
} from '@pipou/shared';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Types stockés dans `notification` (les patchnotes ont leur propre table). */
const STORED_TYPES = Object.values(NotificationType).filter(
  (t) => t !== NotificationType.PATCHNOTE,
);
const typesOf = (category?: NotificationCategory): NotificationType[] =>
  STORED_TYPES.filter(
    (t) => !category || NOTIFICATION_CATEGORY_OF[t] === category,
  );

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifications: Repository<Notification>,
    @InjectRepository(Patchnote)
    private patchnotes: Repository<Patchnote>,
    @InjectRepository(PatchnoteRead)
    private patchnoteReads: Repository<PatchnoteRead>,
    private eventEmitter: EventEmitter2,
  ) {}

  /* ===================== ÉCRITURE ===================== */

  async notify<T extends NotificationType>(
    userId: number,
    type: T,
    payload: NotificationPayloadMap[T],
    refId: number | null = null,
  ): Promise<void> {
    await this.notifications.save(
      this.notifications.create({
        userId,
        type,
        payload: payload as unknown as Record<string, unknown>,
        refId,
      }),
    );
    this.eventEmitter.emit('notification.created', { userId });
  }

  async createPatchnote(dto: CreatePatchnoteRequest): Promise<Patchnote> {
    const patchnote = await this.patchnotes.save(this.patchnotes.create(dto));
    // userId null : diffusion à tous les joueurs connectés
    this.eventEmitter.emit('notification.created', { userId: null });
    return patchnote;
  }

  /**
   * Marque lu tout ce que le joueur a vu, sauf les quêtes à réclamer (lues à la
   * réclamation), puis supprime ses vieux messages lus.
   */
  async markAllRead(userId: number): Promise<void> {
    await this.notifications.update(
      {
        userId,
        readAt: IsNull(),
        type: Not(NotificationType.QUEST_COMPLETED),
      },
      { readAt: new Date() },
    );

    const unread = await this.unreadPatchnoteIds(userId);
    if (unread.length > 0) {
      await this.patchnoteReads.insert(
        unread.map((patchnoteId) => ({ userId, patchnoteId })),
      );
    }

    await this.notifications.delete({
      userId,
      readAt: LessThan(daysAgo(READ_RETENTION_DAYS)),
    });
  }

  async markQuestsClaimed(
    userId: number,
    userQuestIds: number[],
  ): Promise<void> {
    if (userQuestIds.length === 0) return;
    await this.notifications.update(
      {
        userId,
        type: NotificationType.QUEST_COMPLETED,
        refId: In(userQuestIds),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
  }

  /* ===================== LECTURE ===================== */

  async list(
    userId: number,
    category?: NotificationCategory,
    limit: number = INBOX_PAGE_SIZE,
  ): Promise<NotificationsResponse> {
    const rows = await this.notifications.find({
      where: { userId, type: In(typesOf(category)) },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });

    const patchnotes =
      category === NotificationCategory.REWARD
        ? []
        : await this.patchnotes.find({
            where: {
              createdAt: MoreThanOrEqual(daysAgo(PATCHNOTE_VISIBLE_DAYS)),
            },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: limit,
          });
    const readIds = await this.readPatchnoteIds(
      userId,
      patchnotes.map((p) => p.id),
    );

    const items: NotificationItem[] = [
      // Le payload JSON stocké est écrit par notify(), typé par NotificationPayloadMap
      ...rows.map(
        (n) =>
          ({
            id: `n:${n.id}`,
            type: n.type,
            category: NOTIFICATION_CATEGORY_OF[n.type],
            createdAt: n.createdAt.toISOString(),
            read: n.readAt !== null,
            payload: n.payload,
          }) as unknown as NotificationItem,
      ),
      ...patchnotes.map((p): NotificationItem => ({
        id: `p:${p.id}`,
        type: NotificationType.PATCHNOTE,
        category: NotificationCategory.INFORMATION,
        createdAt: p.createdAt.toISOString(),
        read: readIds.has(p.id),
        payload: { title: p.title, body: p.body },
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    return { items, unread: await this.unreadCounts(userId) };
  }

  private async unreadCounts(userId: number): Promise<UnreadCounts> {
    const unreadWhere = (category: NotificationCategory) => ({
      userId,
      readAt: IsNull(),
      type: In(typesOf(category)),
    });
    const [reward, infoMessages, unreadPatchnotes] = await Promise.all([
      this.notifications.count({
        where: unreadWhere(NotificationCategory.REWARD),
      }),
      this.notifications.count({
        where: unreadWhere(NotificationCategory.INFORMATION),
      }),
      this.unreadPatchnoteIds(userId),
    ]);
    const information = infoMessages + unreadPatchnotes.length;
    return { all: reward + information, reward, information };
  }

  /** Patchnotes visibles (30 j) que le joueur n'a pas encore lus. */
  private async unreadPatchnoteIds(userId: number): Promise<number[]> {
    const recent = await this.patchnotes.find({
      where: { createdAt: MoreThanOrEqual(daysAgo(PATCHNOTE_VISIBLE_DAYS)) },
      select: { id: true },
    });
    const ids = recent.map((p) => p.id);
    const read = await this.readPatchnoteIds(userId, ids);
    return ids.filter((id) => !read.has(id));
  }

  private async readPatchnoteIds(
    userId: number,
    patchnoteIds: number[],
  ): Promise<Set<number>> {
    if (patchnoteIds.length === 0) return new Set();
    const reads = await this.patchnoteReads.find({
      where: { userId, patchnoteId: In(patchnoteIds) },
    });
    return new Set(reads.map((r) => r.patchnoteId));
  }

  /* ===================== ÉVÉNEMENTS ===================== */

  @OnEvent('quest.completed')
  async onQuestCompleted(payload: {
    userId: number;
    userQuestId: number;
    title: string;
    rewardType: QuestRewardType;
    rewardAmount: number;
  }): Promise<void> {
    const { userId, ...data } = payload;
    await this.notify(
      userId,
      NotificationType.QUEST_COMPLETED,
      data,
      data.userQuestId,
    );
  }

  @OnEvent('quest.claimed')
  async onQuestClaimed(payload: {
    userId: number;
    userQuestIds: number[];
  }): Promise<void> {
    await this.markQuestsClaimed(payload.userId, payload.userQuestIds);
  }

  @OnEvent('listing.sold')
  async onListingSold(payload: {
    sellerId: number;
    buyerUsername: string;
    itemName: string;
    totalPrice: number;
    transactionId: number;
  }): Promise<void> {
    const { sellerId, ...data } = payload;
    await this.notify(sellerId, NotificationType.LISTING_SOLD, data);
  }

  @OnEvent('booster.opened')
  async onBoosterOpened(payload: {
    userId: number;
    boosterName?: string;
    cards?: CardDropEntry[];
  }): Promise<void> {
    const notable = (payload.cards ?? []).filter(isNotableDrop);
    if (notable.length === 0) return;
    await this.notify(payload.userId, NotificationType.CARD_DROP, {
      boosterName: payload.boosterName ?? '',
      cards: notable,
    });
  }
}
