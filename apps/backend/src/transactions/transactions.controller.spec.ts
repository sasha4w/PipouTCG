import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transactions.controller';
import { TransactionService } from './transactions.service';
import { TransactionStatsService } from './stats/transaction-stats.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { ProductType, TransactionStatus } from '@pipou/shared';

const mockTransactionService = {
  findAll: jest.fn(),
  createListing: jest.fn(),
  buyListing: jest.fn(),
  getUserHistory: jest.fn(),
  getRecentSales: jest.fn(),
};

const mockStatsService = { getStats: jest.fn() };

const pagination = { page: 1, limit: 20 };

const fakeListing = {
  id: 1,
  productType: ProductType.CARD,
  productId: 1,
  quantity: 1,
  unitPrice: 100,
  totalPrice: 100,
  status: TransactionStatus.PENDING,
};

describe('TransactionController', () => {
  let controller: TransactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: TransactionStatsService, useValue: mockStatsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated listings', async () => {
      const fake = { data: [fakeListing], meta: { total: 1 } };
      mockTransactionService.findAll.mockResolvedValue(fake);

      const result = await controller.findAll(pagination);
      expect(mockTransactionService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fake);
    });
  });

  // ======= CREATE LISTING =======
  describe('createListing', () => {
    it('should call createListing with dto and userId', async () => {
      const dto = {
        productType: ProductType.CARD,
        productId: 1,
        quantity: 1,
        unitPrice: 100,
      };
      const req = { user: { userId: 1, isAdmin: false } };
      mockTransactionService.createListing.mockResolvedValue(fakeListing);

      const result = await controller.createListing(dto, req);
      expect(mockTransactionService.createListing).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual(fakeListing);
    });
  });

  // ======= BUY LISTING =======
  describe('buyListing', () => {
    it('should call buyListing with transactionId, userId and quantity', async () => {
      const req = { user: { userId: 2, isAdmin: false } };
      const fakeCompleted = {
        ...fakeListing,
        status: TransactionStatus.COMPLETED,
      };
      mockTransactionService.buyListing.mockResolvedValue(fakeCompleted);

      const result = await controller.buyListing(1, req, { quantity: 1 });
      expect(mockTransactionService.buyListing).toHaveBeenCalledWith(1, 2, 1);
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  // ======= GET HISTORY =======
  describe('getHistory', () => {
    it('should return user transaction history filtered by role', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      const fake = { data: [fakeListing], meta: { total: 1 } };
      mockTransactionService.getUserHistory.mockResolvedValue(fake);
      const query = {
        ...pagination,
        role: 'buyer' as const,
        sort: 'price' as const,
      };

      const result = await controller.getHistory(req, query);
      expect(mockTransactionService.getUserHistory).toHaveBeenCalledWith(
        1,
        query,
        'buyer',
        'price',
      );
      expect(result).toEqual(fake);
    });
  });

  // ======= SALES =======
  describe('getRecentSales', () => {
    it('should pass the player filter to the service', async () => {
      mockTransactionService.getRecentSales.mockResolvedValue({ data: [] });
      const query = {
        ...pagination,
        sort: 'price' as const,
        userId: 3,
        role: 'buyer' as const,
      };

      await controller.getRecentSales(query);
      expect(mockTransactionService.getRecentSales).toHaveBeenCalledWith(
        query,
        'price',
        { userId: 3, role: 'buyer' },
      );
    });
  });

  describe('getSalesStats', () => {
    it('should return the stats for the filter', async () => {
      const fake = { count: 1 };
      mockStatsService.getStats.mockResolvedValue(fake);

      const result = await controller.getSalesStats({
        userId: 3,
        role: 'seller',
      });
      expect(mockStatsService.getStats).toHaveBeenCalledWith({
        userId: 3,
        role: 'seller',
      });
      expect(result).toBe(fake);
    });
  });
});
