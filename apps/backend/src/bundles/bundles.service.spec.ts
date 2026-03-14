import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BundlesService } from './bundles.service';
import { Bundle } from './bundle.entity';
import { BundleContent } from './bundle-content.entity';
import { UsersService } from '../users/users.service';

const mockBundleRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockBundleContentRepo = {
  create: jest.fn(),
  save: jest.fn(),
  manager: {
    transaction: jest.fn().mockImplementation(async (cb: any) => {
      const fakeManager = {
        save: jest.fn().mockResolvedValue({ id: 1 }),
        create: jest.fn().mockReturnValue({}),
      };
      return cb(fakeManager);
    }),
  },
};

const mockUsersService = {
  findOne: jest.fn(),
  spendGoldAndRecordBundlePurchase: jest.fn(),
  addBundleToUser: jest.fn(),
  removeBundleFromUser: jest.fn(),
  distributeBundleContents: jest.fn(),
  addExperience: jest.fn(),
  addCardToUser: jest.fn(),
  addBoosterToUser: jest.fn(),
};

describe('BundlesService', () => {
  let service: BundlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundlesService,
        { provide: getRepositoryToken(Bundle), useValue: mockBundleRepo },
        {
          provide: getRepositoryToken(BundleContent),
          useValue: mockBundleContentRepo,
        },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<BundlesService>(BundlesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated bundles', async () => {
      const fakeBundles = [{ id: 1, name: 'Bundle XP' }];
      mockBundleRepo.findAndCount.mockResolvedValue([fakeBundles, 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual(fakeBundles);
      expect(result.meta.total).toBe(1);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return bundle if found', async () => {
      const fake = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fake);

      const result = await service.findOne(1);
      expect(result).toEqual(fake);
    });

    it('should throw NotFoundException if not found', async () => {
      mockBundleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= CREATE =======
  describe('create', () => {
    it('should create and save bundle', async () => {
      const dto = { name: 'Bundle XP' };
      const fake = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.create.mockReturnValue(fake);
      mockBundleRepo.save.mockResolvedValue(fake);

      const result = await service.create(dto);
      expect(mockBundleRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fake);
    });
  });

  // ======= UPDATE =======
  describe('update', () => {
    it('should update and save bundle', async () => {
      const fake = { id: 1, name: 'Old Name' };
      mockBundleRepo.findOne.mockResolvedValue(fake);
      mockBundleRepo.save.mockResolvedValue({ id: 1, name: 'New Name' });

      const result = await service.update(1, { name: 'New Name' });
      expect(result).toEqual({ id: 1, name: 'New Name' });
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should remove bundle', async () => {
      const fake = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fake);
      mockBundleRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Bundle 1 deleted' });
    });
  });

  // ======= ADD CONTENT =======
  describe('addContent', () => {
    it('should throw if totalQuantity < 2', async () => {
      const fakeBundle = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);

      await expect(
        service.addContent(1, { items: [{ cardId: 1, quantity: 1 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if item has both cardId and boosterId', async () => {
      const fakeBundle = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);

      await expect(
        service.addContent(1, {
          items: [
            { cardId: 1, boosterId: 1, quantity: 1 },
            { cardId: 2, quantity: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if item has neither cardId nor boosterId', async () => {
      const fakeBundle = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);

      await expect(
        service.addContent(1, {
          items: [{ quantity: 1 }, { cardId: 2, quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add items to bundle', async () => {
      const fakeBundle = { id: 1, name: 'Bundle XP' };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);
      mockBundleContentRepo.create.mockReturnValue({ id: 1 });
      mockBundleContentRepo.save.mockResolvedValue({ id: 1 });

      await service.addContent(1, {
        items: [
          { cardId: 5, quantity: 2 },
          { boosterId: 3, quantity: 1 },
        ],
      });

      expect(mockBundleContentRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // ======= BUY BUNDLE =======
  describe('buyBundle', () => {
    it('should buy bundle if enough gold', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: 1, gold: 1000 });
      mockBundleRepo.findOne.mockResolvedValue({
        id: 1,
        name: 'Bundle XP',
        price: 100,
      });
      mockUsersService.spendGoldAndRecordBundlePurchase.mockResolvedValue(
        undefined,
      );
      mockUsersService.addBundleToUser.mockResolvedValue(undefined);

      const result = await service.buyBundle(1, 1);
      expect(result.goldSpent).toBe(100);
      expect(result.goldRemaining).toBe(900);
    });

    it('should throw BadRequestException if not enough gold', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: 1, gold: 50 });
      mockBundleRepo.findOne.mockResolvedValue({ id: 1, price: 100 });

      await expect(service.buyBundle(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(service.buyBundle(1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= OPEN BUNDLE =======
  describe('openBundle', () => {
    it('should open bundle and return summary', async () => {
      const fakeBundle = {
        id: 1,
        name: 'Bundle XP',
        contents: [
          { card: { id: 1, name: 'Dragon' }, booster: null, quantity: 1 },
        ],
      };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);
      mockUsersService.removeBundleFromUser.mockResolvedValue(null);
      mockUsersService.addCardToUser.mockResolvedValue(undefined);
      mockUsersService.addExperience.mockResolvedValue(undefined);

      const result = await service.openBundle(1, 1);

      expect(result.cards).toEqual([{ name: 'Dragon', quantity: 1 }]);
      expect(result.boosters).toEqual([]);
      expect(mockUsersService.addExperience).toHaveBeenCalledWith(1, 100);
    });

    it('should distribute boosters if bundle contains boosters', async () => {
      const fakeBundle = {
        id: 1,
        name: 'Bundle XP',
        contents: [
          { card: null, booster: { id: 2, name: 'Fire Pack' }, quantity: 3 },
        ],
      };
      mockBundleRepo.findOne.mockResolvedValue(fakeBundle);
      mockUsersService.removeBundleFromUser.mockResolvedValue(null);
      mockUsersService.addBoosterToUser.mockResolvedValue(undefined);
      mockUsersService.addExperience.mockResolvedValue(undefined);

      const result = await service.openBundle(1, 1);

      expect(result.boosters).toEqual([{ name: 'Fire Pack', quantity: 3 }]);
      expect(result.cards).toEqual([]);
    });
  });
});
