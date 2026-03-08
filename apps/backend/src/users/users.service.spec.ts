import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserCard } from './user-card.entity';
import { UserBooster } from './user-booster.entity';
import { UserBundle } from './user-bundle.entity';

// ======= MOCKS REPOSITORIES =======
const mockUserRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  increment: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserCardRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockUserBoosterRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockUserBundleRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserCard), useValue: mockUserCardRepo },
        {
          provide: getRepositoryToken(UserBooster),
          useValue: mockUserBoosterRepo,
        },
        {
          provide: getRepositoryToken(UserBundle),
          useValue: mockUserBundleRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated users', async () => {
      const fakeUsers = [{ id: 1, username: 'john' }];
      mockUserRepo.findAndCount.mockResolvedValue([fakeUsers, 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(fakeUsers);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return user with level data', async () => {
      const fakeUser = { id: 1, username: 'john', experience: 25 };
      mockUserRepo.findOne.mockResolvedValue(fakeUser);

      const result = await service.findOne(1);

      expect(result).toMatchObject({ id: 1, level: expect.any(Number) });
    });

    it('should return null if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);
      expect(result).toBeNull();
    });
  });

  // ======= TOGGLE PRIVACY =======
  describe('togglePrivacy', () => {
    it('should toggle isPrivate to true', async () => {
      const fakeUser = { id: 1, isPrivate: false };
      mockUserRepo.findOneBy.mockResolvedValue(fakeUser);
      mockUserRepo.save.mockResolvedValue({ ...fakeUser, isPrivate: true });

      const result = await service.togglePrivacy(1);
      expect(result).toEqual({ isPrivate: true });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);

      await expect(service.togglePrivacy(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= CALCULATE LEVEL DATA =======
  describe('calculateLevelData', () => {
    it('should return level 1 at 0 xp', () => {
      const result = service.calculateLevelData(0);
      expect(result.level).toBe(1);
      expect(result.currentXp).toBe(0);
    });

    it('should level up correctly at 10 xp', () => {
      const result = service.calculateLevelData(10);
      expect(result.level).toBe(2);
    });

    it('should return correct progressPercent', () => {
      const result = service.calculateLevelData(5); // 5/10 xp = 50%
      expect(result.progressPercent).toBe(50);
    });
  });

  // ======= ADD CARD TO USER =======
  describe('addCardToUser', () => {
    it('should increment quantity if card already owned', async () => {
      const existing = { id: 1, quantity: 2 };
      mockUserCardRepo.findOne.mockResolvedValue(existing);
      mockUserCardRepo.save.mockResolvedValue({ ...existing, quantity: 3 });

      await service.addCardToUser(1, 10, 1);

      expect(mockUserCardRepo.save).toHaveBeenCalledWith({
        id: 1,
        quantity: 3,
      });
    });

    it('should create new entry if card not owned', async () => {
      mockUserCardRepo.findOne.mockResolvedValue(null);
      mockUserCardRepo.create.mockReturnValue({ quantity: 1 });
      mockUserCardRepo.save.mockResolvedValue({ quantity: 1 });

      await service.addCardToUser(1, 10, 1);

      expect(mockUserCardRepo.create).toHaveBeenCalled();
      expect(mockUserCardRepo.save).toHaveBeenCalled();
    });
  });

  // ======= REMOVE BOOSTER =======
  describe('removeBoosterFromUser', () => {
    it('should decrement quantity if > 1', async () => {
      const existing = { quantity: 2 };
      mockUserBoosterRepo.findOne.mockResolvedValue(existing);
      mockUserBoosterRepo.save.mockResolvedValue({ quantity: 1 });

      await service.removeBoosterFromUser(1, 5);
      expect(mockUserBoosterRepo.save).toHaveBeenCalled();
    });

    it('should remove entry if quantity becomes 0', async () => {
      const existing = { quantity: 1 };
      mockUserBoosterRepo.findOne.mockResolvedValue(existing);
      mockUserBoosterRepo.remove.mockResolvedValue(null);

      const result = await service.removeBoosterFromUser(1, 5);
      expect(mockUserBoosterRepo.remove).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw BadRequestException if booster not owned', async () => {
      mockUserBoosterRepo.findOne.mockResolvedValue(null);

      await expect(service.removeBoosterFromUser(1, 5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ======= REMOVE BUNDLE =======
  describe('removeBundleFromUser', () => {
    it('should throw BadRequestException if bundle not owned', async () => {
      mockUserBundleRepo.findOne.mockResolvedValue(null);

      await expect(service.removeBundleFromUser(1, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove entry if quantity becomes 0', async () => {
      const existing = { quantity: 1 };
      mockUserBundleRepo.findOne.mockResolvedValue(existing);
      mockUserBundleRepo.remove.mockResolvedValue(null);

      const result = await service.removeBundleFromUser(1, 5);
      expect(result).toBeNull();
    });
  });
});
