import { Test, TestingModule } from '@nestjs/testing';
import { BoostersController } from './boosters.controller';
import { BoostersService } from './boosters.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { CardNumber } from './enums/cardnumber.enum';

const mockBoostersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  buyBooster: jest.fn(),
  openBooster: jest.fn(),
};

const pagination = { page: 1, limit: 20 };

describe('BoostersController', () => {
  let controller: BoostersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoostersController],
      providers: [{ provide: BoostersService, useValue: mockBoostersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<BoostersController>(BoostersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= PUBLIC =======
  describe('findAll', () => {
    it('should return paginated boosters', async () => {
      const fake = { data: [], meta: { total: 0 } };
      mockBoostersService.findAll.mockResolvedValue(fake);

      const result = await controller.findAll(pagination);
      expect(mockBoostersService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fake);
    });
  });

  describe('findOne', () => {
    it('should return one booster', async () => {
      const fake = { id: 1, name: 'Booster Fire', price: 100 };
      mockBoostersService.findOne.mockResolvedValue(fake);

      const result = await controller.findOne(1);
      expect(mockBoostersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fake);
    });
  });

  // ======= USER =======
  describe('buyBooster', () => {
    it('should call buyBooster with boosterId and userId', async () => {
      const req = { user: { userId: 1 } };
      const fake = {
        message: 'Booster acheté',
        goldSpent: 100,
        goldRemaining: 900,
      };
      mockBoostersService.buyBooster.mockResolvedValue(fake);

      const result = await controller.buyBooster(1, req);
      expect(mockBoostersService.buyBooster).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(fake);
    });
  });

  describe('openBooster', () => {
    it('should call openBooster with boosterId and userId', async () => {
      const req = { user: { userId: 1 } };
      const fake = { historyId: 1, booster: 'Booster Fire', cards: [] };
      mockBoostersService.openBooster.mockResolvedValue(fake);

      const result = await controller.openBooster(1, req);
      expect(mockBoostersService.openBooster).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(fake);
    });
  });

  // ======= ADMIN =======
  describe('create', () => {
    it('should create a booster', async () => {
      const dto = {
        name: 'Booster Fire',
        cardNumber: CardNumber.EIGHT,
        cardSetId: 1,
        price: 100,
      };
      const fake = { id: 1, ...dto };
      mockBoostersService.create.mockResolvedValue(fake);

      const result = await controller.create(dto);
      expect(mockBoostersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fake);
    });
  });

  describe('update', () => {
    it('should update a booster', async () => {
      const dto = { name: 'Booster Updated' };
      const fake = { id: 1, name: 'Booster Updated' };
      mockBoostersService.update.mockResolvedValue(fake);

      const result = await controller.update(1, dto);
      expect(mockBoostersService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(fake);
    });
  });

  describe('remove', () => {
    it('should delete a booster', async () => {
      mockBoostersService.remove.mockResolvedValue({
        message: 'Booster with ID 1 deleted',
      });

      const result = await controller.remove(1);
      expect(mockBoostersService.remove).toHaveBeenCalledWith(1);
    });
  });
});
