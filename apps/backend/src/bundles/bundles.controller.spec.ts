import { Test, TestingModule } from '@nestjs/testing';
import { BundlesController } from './bundles.controller';
import { BundlesService } from './bundles.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

const mockBundlesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addContent: jest.fn(),
  buyBundle: jest.fn(),
  openBundle: jest.fn(),
};

const pagination = { page: 1, limit: 20 };

describe('BundlesController', () => {
  let controller: BundlesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BundlesController],
      providers: [{ provide: BundlesService, useValue: mockBundlesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<BundlesController>(BundlesController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= PUBLIC =======
  describe('findAll', () => {
    it('should return paginated bundles', async () => {
      const fake = { data: [], meta: { total: 0 } };
      mockBundlesService.findAll.mockResolvedValue(fake);

      const result = await controller.findAll(pagination);
      expect(mockBundlesService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fake);
    });
  });

  describe('findOne', () => {
    it('should return one bundle', async () => {
      const fake = { id: 1, name: 'Bundle XP' };
      mockBundlesService.findOne.mockResolvedValue(fake);

      const result = await controller.findOne(1);
      expect(mockBundlesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fake);
    });
  });

  // ======= USER =======
  describe('buyBundle', () => {
    it('should call buyBundle with bundleId and userId', async () => {
      const req = { user: { userId: 1 } };
      const fake = {
        message: 'Bundle acheté',
        goldSpent: 100,
        goldRemaining: 900,
      };
      mockBundlesService.buyBundle.mockResolvedValue(fake);

      const result = await controller.buyBundle(1, req);
      expect(mockBundlesService.buyBundle).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(fake);
    });
  });

  describe('openBundle', () => {
    it('should call openBundle with bundleId and userId', async () => {
      const req = { user: { userId: 1 } };
      const fake = { message: 'Bundle ouvert', cards: [], boosters: [] };
      mockBundlesService.openBundle.mockResolvedValue(fake);

      const result = await controller.openBundle(1, req);
      expect(mockBundlesService.openBundle).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(fake);
    });
  });

  // ======= ADMIN =======
  describe('create', () => {
    it('should create a bundle', async () => {
      const dto = { name: 'Bundle XP' };
      const fake = { id: 1, name: 'Bundle XP' };
      mockBundlesService.create.mockResolvedValue(fake);

      const result = await controller.create(dto);
      expect(mockBundlesService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fake);
    });
  });

  describe('update', () => {
    it('should update a bundle', async () => {
      const dto = { name: 'Bundle Updated' };
      const fake = { id: 1, name: 'Bundle Updated' };
      mockBundlesService.update.mockResolvedValue(fake);

      const result = await controller.update(1, dto);
      expect(mockBundlesService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(fake);
    });
  });

  describe('remove', () => {
    it('should delete a bundle', async () => {
      mockBundlesService.remove.mockResolvedValue({
        message: 'Bundle 1 deleted',
      });

      const result = await controller.remove(1);
      expect(mockBundlesService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('addContent', () => {
    it('should add a card to bundle', async () => {
      const dto = { cardId: 5 };
      mockBundlesService.addContent.mockResolvedValue({ id: 1 });

      await controller.addContent(1, dto);
      expect(mockBundlesService.addContent).toHaveBeenCalledWith(1, dto);
    });

    it('should add a booster to bundle', async () => {
      const dto = { boosterId: 3 };
      mockBundlesService.addContent.mockResolvedValue({ id: 1 });

      await controller.addContent(1, dto);
      expect(mockBundlesService.addContent).toHaveBeenCalledWith(1, dto);
    });
  });
});
