import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionService } from './transactions.service';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { Card } from '../cards/card.entity';
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

// ======= MOCKS =======
const mockTransactionRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
};

const mockEventEmitter = { emit: jest.fn() };

const mockManager = {
  findOne: jest.fn(),
  create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
  save: jest.fn(async (entity: unknown) =>
    Array.isArray(entity) ? entity : { id: 42, ...(entity as object) },
  ),
  increment: jest.fn(),
  update: jest.fn(),
  getRepository: jest.fn(() => ({
    create: jest.fn((data: object) => ({ ...data })),
  })),
};

const mockDataSource = {
  transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
    cb(mockManager),
  ),
};

type FindOneStubs = {
  listing?: object | null;
  users?: Record<number, object | null>;
  inventory?: object | null;
  card?: object | null;
  created?: object | null;
};

/** Répond à manager.findOne selon l'entité demandée, pas selon l'ordre des appels. */
function stubFindOne(stubs: FindOneStubs) {
  mockManager.findOne.mockImplementation(
    (entity: unknown, options: { where: { id?: number } }) => {
      if (entity === Transaction) {
        // 1er appel : l'annonce à acheter ; après création : l'annonce relue
        return Promise.resolve(
          options.where.id === 42 ? stubs.created : stubs.listing,
        );
      }
      if (entity === User)
        return Promise.resolve(stubs.users?.[options.where.id!] ?? null);
      if (entity === Card) return Promise.resolve(stubs.card ?? null);
      return Promise.resolve(stubs.inventory ?? null);
    },
  );
}

// ======= FAKE DATA =======
const seller = () => ({ id: 1, username: 'seller', gold: 500, moneyEarned: 0 });
const buyer = () => ({ id: 2, username: 'buyer', gold: 1000, moneySpent: 0 });

const listing = (overrides: object = {}) => ({
  id: 1,
  productType: ProductType.CARD,
  productId: 10,
  quantity: 2,
  unitPrice: 100,
  totalPrice: 200,
  status: TransactionStatus.PENDING,
  itemName: 'Dragon',
  seller: { id: 1, username: 'seller' },
  buyer: null,
  ...overrides,
});

const inventoryEntityFor = {
  [ProductType.CARD]: UserCard,
  [ProductType.BOOSTER]: UserBooster,
  [ProductType.BUNDLE]: UserBundle,
};

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ============================================================
  // FIND ALL
  // ============================================================
  describe('findAll', () => {
    it('should return paginated pending listings', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[listing()], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([listing()]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ============================================================
  // CREATE LISTING
  // ============================================================
  describe('createListing', () => {
    const dto = (productType: ProductType, quantity = 2) => ({
      productType,
      productId: 10,
      quantity,
      unitPrice: 100,
    });

    it.each([ProductType.CARD, ProductType.BOOSTER, ProductType.BUNDLE])(
      'should reserve %s stock and create a pending listing',
      async (productType) => {
        const inventory = { id: 5, quantity: 5, card: { name: 'Dragon' } };
        const created = listing({ id: 42, productType });
        stubFindOne({ inventory, created });

        const result = await service.createListing(dto(productType), 1);

        expect(mockManager.findOne).toHaveBeenCalledWith(
          inventoryEntityFor[productType],
          expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
        );
        expect(inventory.quantity).toBe(3);
        expect(mockManager.save).toHaveBeenCalledWith(
          expect.objectContaining({
            seller: { id: 1 },
            productType,
            quantity: 2,
            totalPrice: 200,
            status: TransactionStatus.PENDING,
          }),
        );
        expect(result).toEqual(created);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'listing.created',
          expect.objectContaining({ id: 42, quantity: 2 }),
        );
      },
    );

    it('should throw if the seller does not own the item', async () => {
      stubFindOne({ inventory: null });

      await expect(
        service.createListing(dto(ProductType.CARD), 1),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should throw if the seller does not have enough quantity', async () => {
      stubFindOne({ inventory: { id: 5, quantity: 1 } });

      await expect(
        service.createListing(dto(ProductType.BOOSTER, 5), 1),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // BUY LISTING
  // ============================================================
  describe('buyListing', () => {
    it('should throw if listing not found', async () => {
      stubFindOne({ listing: null });

      await expect(service.buyListing(999, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if listing already sold', async () => {
      stubFindOne({
        listing: listing({ status: TransactionStatus.COMPLETED }),
      });

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if requested quantity exceeds the listing', async () => {
      stubFindOne({ listing: listing(), users: { 1: seller(), 2: buyer() } });

      await expect(service.buyListing(1, 2, 3)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer not found', async () => {
      stubFindOne({ listing: listing(), users: { 1: seller() } });

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer is the seller', async () => {
      stubFindOne({ listing: listing(), users: { 1: seller() } });

      await expect(service.buyListing(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer does not have enough gold', async () => {
      stubFindOne({
        listing: listing(),
        users: { 1: seller(), 2: { ...buyer(), gold: 10 } },
      });

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should complete a full CARD purchase', async () => {
      const b = buyer();
      const s = seller();
      stubFindOne({
        listing: listing(),
        users: { 1: s, 2: b },
        inventory: null,
        card: { id: 10, cardSet: { id: 7 } },
      });

      const result = await service.buyListing(1, 2);

      expect(b.gold).toBe(800);
      expect(s.gold).toBe(700);
      expect(mockManager.create).toHaveBeenCalledWith(UserCard, {
        user: { id: 2 },
        card: { id: 10 },
        quantity: 2,
      });
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 2 },
        'cardsBought',
        2,
      );
      expect(mockManager.increment).toHaveBeenCalledWith(
        User,
        { id: 1 },
        'cardsSold',
        2,
      );
      expect(mockManager.update).toHaveBeenCalledWith(
        Transaction,
        1,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          totalPrice: 200,
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('card.set.check', {
        userId: 2,
        setId: 7,
      });
      expect(result).toEqual(
        expect.objectContaining({ purchasedQty: 2, totalPrice: 200 }),
      );
    });

    it('should add to the buyer stack if they already own the item', async () => {
      const buyerStack = { id: 9, quantity: 3 };
      stubFindOne({
        listing: listing(),
        users: { 1: seller(), 2: buyer() },
        inventory: buyerStack,
      });

      await service.buyListing(1, 2);

      expect(buyerStack.quantity).toBe(5);
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it('should keep a partial purchase listed with the remaining quantity', async () => {
      stubFindOne({ listing: listing(), users: { 1: seller(), 2: buyer() } });

      await service.buyListing(1, 2, 1);

      expect(mockManager.update).toHaveBeenCalledWith(
        Transaction,
        1,
        expect.objectContaining({ quantity: 1, totalPrice: 100 }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('listing.updated', {
        transactionId: 1,
        newQuantity: 1,
      });
    });

    it.each([
      [ProductType.BOOSTER, 'boostersBought', 'boostersSold'],
      [ProductType.BUNDLE, 'bundlesBought', 'bundlesSold'],
    ])(
      'should update %s purchase counters',
      async (productType, boughtField, soldField) => {
        stubFindOne({
          listing: listing({ productType }),
          users: { 1: seller(), 2: buyer() },
        });

        await service.buyListing(1, 2);

        expect(mockManager.create).toHaveBeenCalledWith(
          inventoryEntityFor[productType],
          expect.objectContaining({ quantity: 2 }),
        );
        expect(mockManager.increment).toHaveBeenCalledWith(
          User,
          { id: 2 },
          boughtField,
          2,
        );
        expect(mockManager.increment).toHaveBeenCalledWith(
          User,
          { id: 1 },
          soldField,
          2,
        );
      },
    );
  });

  // ============================================================
  // GET USER HISTORY
  // ============================================================
  describe('getUserHistory', () => {
    it('should return paginated transaction history', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[listing()], 1]);

      const result = await service.getUserHistory(1, { page: 1, limit: 20 });
      expect(result.data).toEqual([listing()]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should use default pagination if not provided', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getUserHistory(1, {});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
