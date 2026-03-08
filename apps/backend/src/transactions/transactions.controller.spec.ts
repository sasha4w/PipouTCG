import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transactions.controller';
import { TransactionService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

const mockTransactionService = {
  createListing: jest.fn(),
  buyListing: jest.fn(),
  getUserHistory: jest.fn(),
};

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
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= CREATE LISTING =======
  describe('createListing', () => {
    it('should call createListing with dto and userId', async () => {
      const dto = {
        productType: ProductType.CARD,
        productId: 1,
        quantity: 1,
        unitPrice: 100,
      };
      const req = { user: { userId: 1 } };
      mockTransactionService.createListing.mockResolvedValue(fakeListing);

      const result = await controller.createListing(dto, req);
      expect(mockTransactionService.createListing).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual(fakeListing);
    });
  });

  // ======= BUY LISTING =======
  describe('buyListing', () => {
    it('should call buyListing with transactionId and userId', async () => {
      const req = { user: { userId: 2 } };
      const fakeCompleted = {
        ...fakeListing,
        status: TransactionStatus.COMPLETED,
      };
      mockTransactionService.buyListing.mockResolvedValue(fakeCompleted);

      const result = await controller.buyListing(1, req);
      expect(mockTransactionService.buyListing).toHaveBeenCalledWith(1, 2);
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  // ======= GET HISTORY =======
  describe('getHistory', () => {
    it('should return user transaction history', async () => {
      const req = { user: { userId: 1 } };
      const fake = { data: [fakeListing], meta: { total: 1 } };
      mockTransactionService.getUserHistory.mockResolvedValue(fake);

      const result = await controller.getHistory(req, pagination);
      expect(mockTransactionService.getUserHistory).toHaveBeenCalledWith(
        1,
        pagination,
      );
      expect(result).toEqual(fake);
    });
  });
});
