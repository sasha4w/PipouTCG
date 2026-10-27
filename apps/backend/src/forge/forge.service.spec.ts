import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Rarity } from '@pipou/shared';
import { ForgeService } from './forge.service';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { Card } from '../cards/card.entity';

const mockEventEmitter = { emit: jest.fn() };

const mockManager = {
  findOne: jest.fn(),
  find: jest.fn(),
  query: jest.fn(),
  create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  increment: jest.fn(),
};

const mockUserCardRepo = { find: jest.fn() };

const mockDataSource = {
  transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
    cb(mockManager),
  ),
  getRepository: jest.fn(() => mockUserCardRepo),
  query: jest.fn(),
};

const card = (id: number, rarity: Rarity, setId = 1) => ({
  id,
  rarity,
  effects: null,
  cardSet: { id: setId },
});

/** UserCard tel que renvoyé sous verrou (relation card réduite à son id). */
const userCard = (id: number, cardId: number, quantity: number) => ({
  id,
  card: cardId,
  quantity,
});

function stub(opts: {
  userCards?: object[];
  cards?: object[];
  protectedRows?: object[];
  target?: object | null;
  dust?: number;
}) {
  mockManager.find.mockImplementation((entity: unknown) => {
    if (entity === UserCard) return Promise.resolve(opts.userCards ?? []);
    if (entity === Card) return Promise.resolve(opts.cards ?? []);
    return Promise.resolve([]);
  });
  mockManager.query.mockResolvedValue(opts.protectedRows ?? []);
  mockManager.findOne.mockImplementation((entity: unknown) => {
    if (entity === User)
      return Promise.resolve({ id: 1, dust: opts.dust ?? 0 });
    if (entity === UserCard) return Promise.resolve(opts.target ?? null);
    return Promise.resolve(null);
  });
}

describe('ForgeService', () => {
  let service: ForgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ForgeService(
      mockDataSource as unknown as DataSource,
      mockEventEmitter as unknown as EventEmitter2,
    );
  });

  describe('listUsable', () => {
    it('retire la plus grande quantité utilisée parmi les decks', async () => {
      mockUserCardRepo.find.mockResolvedValue([
        { id: 100, quantity: 5, card: { id: 10 } },
        { id: 101, quantity: 3, card: { id: 11 } },
      ]);
      mockDataSource.query.mockResolvedValue([
        { user_card_id: 100, protected_qty: '3' },
        { user_card_id: 101, protected_qty: '3' },
      ]);

      const result = await service.listUsable(1);

      expect(result).toEqual([
        { cardId: 10, owned: 5, usable: 2 },
        { cardId: 11, owned: 3, usable: 0 },
      ]);
    });
  });

  describe('forge', () => {
    const inputs = [{ cardId: 10, quantity: 10 }];
    const cards = [card(10, Rarity.COMMON), card(20, Rarity.UNCOMMON)];

    it('consomme les entrées, crée la cible et émet les événements', async () => {
      const source = userCard(100, 10, 12);
      stub({ userCards: [source], cards, target: null, dust: 7 });

      const res = await service.forge(1, { inputs, targetCardId: 20 });

      expect(source.quantity).toBe(2);
      expect(mockManager.create).toHaveBeenCalledWith(
        UserCard,
        expect.objectContaining({ quantity: 1 }),
      );
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 1 },
        'cardsForged',
        1,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('forge.done', {
        userId: 1,
        amount: 1,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('card.set.check', {
        userId: 1,
        setId: 1,
      });
      expect(res).toEqual({ targetCardId: 20, dust: 7 });
    });

    it('incrémente la cible si elle existe déjà', async () => {
      const target = userCard(200, 20, 2);
      stub({ userCards: [userCard(100, 10, 10)], cards, target });

      await service.forge(1, { inputs, targetCardId: 20 });

      expect(target.quantity).toBe(3);
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it("rejette si une entrée dépasse l'utilisable, sans rien sauvegarder", async () => {
      stub({
        userCards: [userCard(100, 10, 12)],
        cards,
        protectedRows: [{ user_card_id: 100, protected_qty: '5' }],
      });

      await expect(
        service.forge(1, { inputs, targetCardId: 20 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('détruit 4 communes pour 4 poussières', async () => {
      const source = userCard(100, 10, 6);
      stub({
        userCards: [source],
        cards: [card(10, Rarity.COMMON)],
        dust: 4,
      });

      const res = await service.destroy(1, { cardId: 10, quantity: 4 });

      expect(res).toEqual({ dustGained: 4, dust: 4 });
      expect(source.quantity).toBe(2);
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 1 },
        'dust',
        4,
      );
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 1 },
        'dustEarned',
        4,
      );
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 1 },
        'cardsDestroyed',
        4,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('destroy.done', {
        userId: 1,
        amount: 4,
      });
    });

    it("rejette une quantité supérieure à l'utilisable", async () => {
      stub({
        userCards: [userCard(100, 10, 6)],
        cards: [card(10, Rarity.COMMON)],
        protectedRows: [{ user_card_id: 100, protected_qty: '3' }],
      });

      await expect(
        service.destroy(1, { cardId: 10, quantity: 4 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });
});
