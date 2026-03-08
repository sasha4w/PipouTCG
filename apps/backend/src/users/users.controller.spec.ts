import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

const mockUsersService = {
  getCardPortfolio: jest.fn(),
  getProfile: jest.fn(),
  getInventory: jest.fn(),
  getUserBoosters: jest.fn(),
  getUserBundles: jest.fn(),
  togglePrivacy: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
};

const pagination = { page: 1, limit: 20 };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= PORTFOLIO (toujours visible) =======
  describe('getCardPortfolio', () => {
    it('should return portfolio', async () => {
      const fakePortfolio = { data: [], meta: { total: 0 } };
      mockUsersService.getCardPortfolio.mockResolvedValue(fakePortfolio);

      const result = await controller.getCardPortfolio(1, pagination);

      expect(mockUsersService.getCardPortfolio).toHaveBeenCalledWith(
        1,
        pagination,
      );
      expect(result).toEqual(fakePortfolio);
    });
  });

  // ======= PROFILE (privacy) =======
  describe('getProfile', () => {
    it('should return profile if public', async () => {
      const req = { user: { userId: 2, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: false });
      mockUsersService.getProfile.mockResolvedValue({
        id: 1,
        username: 'john',
      });

      const result = await controller.getProfile(1, req);
      expect(result).toEqual({ id: 1, username: 'john' });
    });

    it('should return profile if owner even if private', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: true });
      mockUsersService.getProfile.mockResolvedValue({
        id: 1,
        username: 'john',
      });

      const result = await controller.getProfile(1, req);
      expect(result).toBeDefined();
    });

    it('should return profile if admin even if private', async () => {
      const req = { user: { userId: 99, isAdmin: true } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: true });
      mockUsersService.getProfile.mockResolvedValue({
        id: 1,
        username: 'john',
      });

      const result = await controller.getProfile(1, req);
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if private and not owner/admin', async () => {
      const req = { user: { userId: 2, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: true });

      await expect(controller.getProfile(1, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user not found', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(controller.getProfile(1, req)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ======= INVENTORY =======
  describe('getInventory', () => {
    it('should return inventory if owner', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: true });
      mockUsersService.getInventory.mockResolvedValue({
        cards: [],
        boosters: [],
        bundles: [],
      });

      const result = await controller.getInventory(1, req);
      expect(result).toBeDefined();
    });

    it('should throw if private and stranger', async () => {
      const req = { user: { userId: 2, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: true });

      await expect(controller.getInventory(1, req)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ======= BOOSTERS =======
  describe('getUserBoosters', () => {
    it('should return boosters if owner', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: false });
      mockUsersService.getUserBoosters.mockResolvedValue({
        data: [],
        meta: {},
      });

      const result = await controller.getUserBoosters(1, req, pagination);
      expect(mockUsersService.getUserBoosters).toHaveBeenCalledWith(
        1,
        pagination,
      );
      expect(result).toBeDefined();
    });
  });

  // ======= BUNDLES =======
  describe('getUserBundles', () => {
    it('should return bundles if owner', async () => {
      const req = { user: { userId: 1, isAdmin: false } };
      mockUsersService.findOne.mockResolvedValue({ id: 1, isPrivate: false });
      mockUsersService.getUserBundles.mockResolvedValue({ data: [], meta: {} });

      const result = await controller.getUserBundles(1, req, pagination);
      expect(mockUsersService.getUserBundles).toHaveBeenCalledWith(
        1,
        pagination,
      );
      expect(result).toBeDefined();
    });
  });

  // ======= TOGGLE PRIVACY (owner only) =======
  describe('togglePrivacy', () => {
    it('should toggle privacy if owner', async () => {
      const req = { user: { userId: 1 } };
      mockUsersService.togglePrivacy.mockResolvedValue({ isPrivate: false });

      const result = await controller.togglePrivacy(1, req);
      expect(mockUsersService.togglePrivacy).toHaveBeenCalledWith(1);
    });

    it('should throw ForbiddenException if not owner', () => {
      const req = { user: { userId: 2 } };

      expect(() => controller.togglePrivacy(1, req)).toThrow(
        ForbiddenException,
      );
    });
  });

  // ======= ADMIN =======
  describe('findAll (admin)', () => {
    it('should return paginated users', async () => {
      const fakeUsers = { data: [], meta: { total: 0 } };
      mockUsersService.findAll.mockResolvedValue(fakeUsers);

      const result = await controller.findAll(pagination);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fakeUsers);
    });
  });

  describe('findOne (admin)', () => {
    it('should return one user', async () => {
      const fakeUser = { id: 1, username: 'john' };
      mockUsersService.findOne.mockResolvedValue(fakeUser);

      const result = await controller.findOne(1);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fakeUser);
    });
  });
});
