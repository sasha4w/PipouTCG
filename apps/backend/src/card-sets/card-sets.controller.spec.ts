import { Test, TestingModule } from '@nestjs/testing';
import { CardSetsController } from './card-sets.controller';
import { CardSetsService } from './card-sets.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

const mockCardSetsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const pagination = { page: 1, limit: 20 };

describe('CardSetsController', () => {
  let controller: CardSetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardSetsController],
      providers: [{ provide: CardSetsService, useValue: mockCardSetsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<CardSetsController>(CardSetsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= PUBLIC =======
  describe('findAll', () => {
    it('should return paginated card sets', async () => {
      const fake = { data: [], meta: { total: 0 } };
      mockCardSetsService.findAll.mockResolvedValue(fake);

      const result = await controller.findAll(pagination);
      expect(mockCardSetsService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fake);
    });
  });

  describe('findOne', () => {
    it('should return one card set', async () => {
      const fake = { id: 1, name: 'Set Fire' };
      mockCardSetsService.findOne.mockResolvedValue(fake);

      const result = await controller.findOne(1);
      expect(mockCardSetsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fake);
    });
  });

  // ======= ADMIN =======
  describe('create', () => {
    it('should create a card set', async () => {
      const dto = { name: 'Set Fire' };
      const fake = { id: 1, name: 'Set Fire' };
      mockCardSetsService.create.mockResolvedValue(fake);

      const result = await controller.create(dto);
      expect(mockCardSetsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fake);
    });
  });

  describe('update', () => {
    it('should update a card set', async () => {
      const dto = { name: 'Set Updated' };
      const fake = { id: 1, name: 'Set Updated' };
      mockCardSetsService.update.mockResolvedValue(fake);

      const result = await controller.update(1, dto);
      expect(mockCardSetsService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(fake);
    });
  });

  describe('remove', () => {
    it('should delete a card set', async () => {
      const fake = { message: 'Card Set with ID 1 has been deleted' };
      mockCardSetsService.remove.mockResolvedValue(fake);

      const result = await controller.remove(1);
      expect(mockCardSetsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(fake);
    });
  });
});
