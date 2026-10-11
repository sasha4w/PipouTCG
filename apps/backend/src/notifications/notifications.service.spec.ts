import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';
import {
  NotificationCategory,
  NotificationType,
  QuestRewardType,
  Rarity,
} from '@pipou/shared';

const notificationRepo = {
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const patchnoteRepo = {
  find: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn(),
};
const patchnoteReadRepo = { find: jest.fn(), insert: jest.fn() };
const emitter = { emit: jest.fn() };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    notificationRepo.find.mockResolvedValue([]);
    notificationRepo.count.mockResolvedValue(0);
    patchnoteRepo.find.mockResolvedValue([]);
    patchnoteReadRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepo,
        },
        { provide: getRepositoryToken(Patchnote), useValue: patchnoteRepo },
        {
          provide: getRepositoryToken(PatchnoteRead),
          useValue: patchnoteReadRepo,
        },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('notify', () => {
    it('sauvegarde le message et prévient le flux temps réel', async () => {
      await service.notify(7, NotificationType.LISTING_SOLD, {
        buyerUsername: 'bob',
        itemName: 'Alpha',
        totalPrice: 120,
        transactionId: 3,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith({
        userId: 7,
        type: NotificationType.LISTING_SOLD,
        payload: {
          buyerUsername: 'bob',
          itemName: 'Alpha',
          totalPrice: 120,
          transactionId: 3,
        },
        refId: null,
      });
      expect(emitter.emit).toHaveBeenCalledWith('notification.created', {
        userId: 7,
      });
    });
  });

  describe('handlers', () => {
    it('quest.completed crée un message lié à la quête', async () => {
      await service.onQuestCompleted({
        userId: 7,
        userQuestId: 42,
        title: 'Ouvre 3 boosters',
        rewardType: QuestRewardType.GOLD,
        rewardAmount: 100,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          type: NotificationType.QUEST_COMPLETED,
          refId: 42,
          payload: {
            userQuestId: 42,
            title: 'Ouvre 3 boosters',
            rewardType: QuestRewardType.GOLD,
            rewardAmount: 100,
          },
        }),
      );
    });

    it('quest.claimed marque lu le message des quêtes réclamées', async () => {
      await service.onQuestClaimed({ userId: 7, userQuestIds: [42, 43] });
      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = notificationRepo.update.mock.calls[0] as [
        Record<string, unknown>,
        { readAt: Date },
      ];
      expect(where.userId).toBe(7);
      expect(where.type).toBe(NotificationType.QUEST_COMPLETED);
      expect(patch.readAt).toBeInstanceOf(Date);
    });

    it('quest.claimed sans quête ne fait rien', async () => {
      await service.onQuestClaimed({ userId: 7, userQuestIds: [] });
      expect(notificationRepo.update).not.toHaveBeenCalled();
    });

    it('listing.sold prévient le vendeur', async () => {
      await service.onListingSold({
        sellerId: 9,
        buyerUsername: 'bob',
        itemName: 'Alpha',
        totalPrice: 50,
        transactionId: 1,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 9,
          type: NotificationType.LISTING_SOLD,
        }),
      );
    });

    it('booster.opened ne garde que les cartes notables, en un seul message', async () => {
      await service.onBoosterOpened({
        userId: 7,
        boosterName: 'Alpha',
        cards: [
          { cardId: 1, name: 'A', rarity: Rarity.COMMON, isNew: false },
          { cardId: 2, name: 'B', rarity: Rarity.LEGENDARY, isNew: false },
          { cardId: 3, name: 'C', rarity: Rarity.COMMON, isNew: true },
        ],
      });
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.CARD_DROP,
          payload: {
            boosterName: 'Alpha',
            cards: [
              { cardId: 2, name: 'B', rarity: Rarity.LEGENDARY, isNew: false },
              { cardId: 3, name: 'C', rarity: Rarity.COMMON, isNew: true },
            ],
          },
        }),
      );
    });

    it('booster.opened sans carte notable ne crée rien', async () => {
      await service.onBoosterOpened({
        userId: 7,
        boosterName: 'Alpha',
        cards: [{ cardId: 1, name: 'A', rarity: Rarity.RARE, isNew: false }],
      });
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    const created = new Date('2026-10-10T10:00:00.000Z');

    it('fusionne messages et patchnotes, du plus récent au plus ancien', async () => {
      notificationRepo.find.mockResolvedValue([
        {
          id: 1,
          type: NotificationType.LISTING_SOLD,
          payload: { itemName: 'Alpha' },
          readAt: null,
          createdAt: created,
        },
      ]);
      patchnoteRepo.find.mockResolvedValue([
        {
          id: 5,
          title: 'v1.2',
          body: 'Équilibrage',
          createdAt: new Date('2026-10-11T08:00:00.000Z'),
        },
      ]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      const res = await service.list(7);

      expect(res.items.map((i) => i.id)).toEqual(['p:5', 'n:1']);
      expect(res.items[0]).toMatchObject({
        type: NotificationType.PATCHNOTE,
        category: NotificationCategory.INFORMATION,
        read: true,
        payload: { title: 'v1.2', body: 'Équilibrage' },
      });
      expect(res.items[1]).toMatchObject({ read: false });
    });

    it("ne charge pas les patchnotes pour l'onglet récompense", async () => {
      await service.list(7, NotificationCategory.REWARD);
      // seule la lecture des non lus (sans `take`) touche aux patchnotes
      for (const [options] of patchnoteRepo.find.mock.calls as [
        Record<string, unknown>,
      ][]) {
        expect(options.take).toBeUndefined();
      }
    });

    it('compte les non lus par catégorie, patchnotes inclus', async () => {
      // 1er count = récompense, 2e = information (hors patchnote)
      notificationRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      patchnoteRepo.find.mockResolvedValue([
        { id: 5, title: 't', body: 'b', createdAt: created },
        { id: 6, title: 't', body: 'b', createdAt: created },
      ]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      const res = await service.list(7);

      expect(res.unread).toEqual({ all: 4, reward: 2, information: 2 });
    });

    it('coupe à la limite demandée', async () => {
      notificationRepo.find.mockResolvedValue(
        [1, 2, 3].map((id) => ({
          id,
          type: NotificationType.LISTING_SOLD,
          payload: {},
          readAt: null,
          createdAt: new Date(2026, 9, id),
        })),
      );
      const res = await service.list(7, undefined, 2);
      expect(res.items).toHaveLength(2);
    });
  });

  describe('markAllRead', () => {
    it('marque lu tout sauf les quêtes, marque les patchnotes, et purge les anciens lus', async () => {
      patchnoteRepo.find.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      await service.markAllRead(7);

      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
      expect(patchnoteReadRepo.insert).toHaveBeenCalledWith([
        { userId: 7, patchnoteId: 6 },
      ]);
      expect(notificationRepo.delete).toHaveBeenCalledTimes(1);
    });

    it("n'insère rien quand tous les patchnotes sont déjà lus", async () => {
      patchnoteRepo.find.mockResolvedValue([{ id: 5 }]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);
      await service.markAllRead(7);
      expect(patchnoteReadRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('createPatchnote', () => {
    it('sauvegarde et diffuse à tous les joueurs', async () => {
      patchnoteRepo.save.mockResolvedValue({ id: 8, title: 'v1.3', body: 'x' });
      const res = await service.createPatchnote({ title: 'v1.3', body: 'x' });
      expect(res.id).toBe(8);
      expect(emitter.emit).toHaveBeenCalledWith('notification.created', {
        userId: null,
      });
    });
  });
});
