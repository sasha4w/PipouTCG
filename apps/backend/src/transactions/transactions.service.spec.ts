import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransactionService } from './transactions.service';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { UsersService } from '../users/users.service';
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

// ======= MOCKS =======
const mockTransactionRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockUsersService = {
  findOne: jest.fn(),
};

const mockManager = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockCardRepo = { findOne: jest.fn(), save: jest.fn() };
const mockBoosterRepo = { findOne: jest.fn(), save: jest.fn() };
const mockBundleRepo = { findOne: jest.fn(), save: jest.fn() };

const mockDataSource = {
  transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
  getRepository: jest.fn().mockImplementation((entity) => {
    if (entity === UserCard) return mockCardRepo;
    if (entity === UserBooster) return mockBoosterRepo;
    if (entity === UserBundle) return mockBundleRepo;
  }),
};

// ======= FAKE DATA =======
const fakeSeller = {
  id: 1,
  gold: 500,
  moneyEarned: 0,
  cardsSold: 0,
  boostersSold: 0,
  bundlesSold: 0,
};

const fakeBuyer = {
  id: 2,
  gold: 1000,
  moneySpent: 0,
  cardsBought: 0,
  boostersBought: 0,
  bundlesBought: 0,
};

const fakeListing = {
  id: 1,
  productType: ProductType.CARD,
  productId: 1,
  quantity: 1,
  unitPrice: 100,
  totalPrice: 100,
  status: TransactionStatus.PENDING,
  seller: fakeSeller,
  buyer: null,
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
        { provide: UsersService, useValue: mockUsersService },
        { provide: DataSource, useValue: mockDataSource },
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
      mockTransactionRepo.findAndCount.mockResolvedValue([[fakeListing], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([fakeListing]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ============================================================
  // CREATE LISTING
  // ============================================================
  describe('createListing', () => {
    const baseDto = { productId: 1, quantity: 1, unitPrice: 100 };

    it('should throw if seller not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(
        service.createListing(
          { ...baseDto, productType: ProductType.CARD },
          999,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ======= CARD =======
    describe('ProductType.CARD', () => {
      it('should create listing and reserve card quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockCardRepo.findOne.mockResolvedValue({ id: 1, quantity: 5 });
        mockCardRepo.save.mockResolvedValue(undefined);
        mockTransactionRepo.create.mockReturnValue(fakeListing);
        mockTransactionRepo.save.mockResolvedValue(fakeListing);

        const result = await service.createListing(
          { ...baseDto, productType: ProductType.CARD },
          1,
        );
        expect(mockCardRepo.save).toHaveBeenCalled();
        expect(result).toEqual(fakeListing);
      });

      it('should throw if card not owned by seller', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockCardRepo.findOne.mockResolvedValue(null);

        await expect(
          service.createListing(
            { ...baseDto, productType: ProductType.CARD },
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw if not enough card quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockCardRepo.findOne.mockResolvedValue({ id: 1, quantity: 0 });

        await expect(
          service.createListing(
            { ...baseDto, productType: ProductType.CARD, quantity: 5 },
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    // ======= BOOSTER =======
    describe('ProductType.BOOSTER', () => {
      it('should create listing and reserve booster quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockBoosterRepo.findOne.mockResolvedValue({ id: 1, quantity: 3 });
        mockBoosterRepo.save.mockResolvedValue(undefined);
        mockTransactionRepo.create.mockReturnValue(fakeListing);
        mockTransactionRepo.save.mockResolvedValue(fakeListing);

        const result = await service.createListing(
          { ...baseDto, productType: ProductType.BOOSTER },
          1,
        );
        expect(mockBoosterRepo.save).toHaveBeenCalled();
        expect(result).toEqual(fakeListing);
      });

      it('should throw if not enough booster quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockBoosterRepo.findOne.mockResolvedValue({ id: 1, quantity: 0 });

        await expect(
          service.createListing(
            { ...baseDto, productType: ProductType.BOOSTER, quantity: 5 },
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    // ======= BUNDLE =======
    describe('ProductType.BUNDLE', () => {
      it('should create listing and reserve bundle quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockBundleRepo.findOne.mockResolvedValue({ id: 1, quantity: 2 });
        mockBundleRepo.save.mockResolvedValue(undefined);
        mockTransactionRepo.create.mockReturnValue(fakeListing);
        mockTransactionRepo.save.mockResolvedValue(fakeListing);

        const result = await service.createListing(
          { ...baseDto, productType: ProductType.BUNDLE },
          1,
        );
        expect(mockBundleRepo.save).toHaveBeenCalled();
        expect(result).toEqual(fakeListing);
      });

      it('should throw if not enough bundle quantity', async () => {
        mockUsersService.findOne.mockResolvedValue(fakeSeller);
        mockBundleRepo.findOne.mockResolvedValue({ id: 1, quantity: 0 });

        await expect(
          service.createListing(
            { ...baseDto, productType: ProductType.BUNDLE, quantity: 5 },
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ============================================================
  // BUY LISTING
  // ============================================================
  describe('buyListing', () => {
    it('should throw if listing not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(service.buyListing(999, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if listing already sold', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...fakeListing,
        status: TransactionStatus.COMPLETED,
      });

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer not found', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...fakeListing })
        .mockResolvedValueOnce(null);

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer is the seller', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...fakeListing })
        .mockResolvedValueOnce({ ...fakeBuyer, id: 1 });

      await expect(service.buyListing(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if buyer does not have enough gold', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...fakeListing, totalPrice: 9999 })
        .mockResolvedValueOnce({ ...fakeBuyer, gold: 10 });

      await expect(service.buyListing(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should complete a CARD transaction', async () => {
      const fakeSellerCard = { id: 1, card: { id: 10 }, quantity: 1 };

      mockManager.findOne
        .mockResolvedValueOnce({ ...fakeListing })
        .mockResolvedValueOnce({ ...fakeBuyer })
        .mockResolvedValueOnce(fakeSellerCard)
        .mockResolvedValueOnce(null);

      mockManager.create.mockReturnValue({ quantity: 1 });
      mockManager.save.mockResolvedValue(undefined);

      await service.buyListing(1, 2);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should increment buyerItem quantity if buyer already owns the card', async () => {
      const fakeSellerCard = { id: 1, card: { id: 10 }, quantity: 1 };
      const existingBuyerCard = { id: 2, card: { id: 10 }, quantity: 3 };

      mockManager.findOne
        .mockResolvedValueOnce({ ...fakeListing })
        .mockResolvedValueOnce({ ...fakeBuyer })
        .mockResolvedValueOnce(fakeSellerCard)
        .mockResolvedValueOnce(existingBuyerCard);

      mockManager.save.mockResolvedValue(undefined);

      await service.buyListing(1, 2);
      expect(existingBuyerCard.quantity).toBe(4);
    });

    it('should complete a BOOSTER transaction', async () => {
      const boosterListing = {
        ...fakeListing,
        productType: ProductType.BOOSTER,
      };
      const fakeSellerBooster = { id: 1, booster: { id: 5 }, quantity: 1 };

      mockManager.findOne
        .mockResolvedValueOnce(boosterListing)
        .mockResolvedValueOnce({ ...fakeBuyer })
        .mockResolvedValueOnce(fakeSellerBooster)
        .mockResolvedValueOnce(null);

      mockManager.create.mockReturnValue({ quantity: 1 });
      mockManager.save.mockResolvedValue(undefined);

      await service.buyListing(1, 2);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should complete a BUNDLE transaction', async () => {
      const bundleListing = { ...fakeListing, productType: ProductType.BUNDLE };
      const fakeSellerBundle = { id: 1, bundle: { id: 3 }, quantity: 1 };

      mockManager.findOne
        .mockResolvedValueOnce(bundleListing)
        .mockResolvedValueOnce({ ...fakeBuyer })
        .mockResolvedValueOnce(fakeSellerBundle)
        .mockResolvedValueOnce(null);

      mockManager.create.mockReturnValue({ quantity: 1 });
      mockManager.save.mockResolvedValue(undefined);

      await service.buyListing(1, 2);
      expect(mockManager.save).toHaveBeenCalled();
    });
  });

  // ============================================================
  // GET USER HISTORY
  // ============================================================
  describe('getUserHistory', () => {
    it('should return paginated transaction history', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[fakeListing], 1]);

      const result = await service.getUserHistory(1, { page: 1, limit: 20 });
      expect(result.data).toEqual([fakeListing]);
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
