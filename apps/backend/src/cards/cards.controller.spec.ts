import { Test, TestingModule } from '@nestjs/testing';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { Rarity } from './enums/rarity.enum';
import { Type } from './enums/cardtype.enum';

const mockCardsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findBySet: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const pagination = { page: 1, limit: 20 };

// Faux fichier image multer
const fakeFile = {
  fieldname: 'image',
  originalname: 'card.png',
  mimetype: 'image/png',
  buffer: Buffer.from('fake-image'),
  size: 1024,
} as Express.Multer.File;

const fakeCard = {
  id: 1,
  name: 'Dragon',
  rarity: Rarity.RARE,
  type: Type.MONSTER,
  atk: 100,
  hp: 200,
  cardSet: { id: 1 },
};

describe('CardsController', () => {
  let controller: CardsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardsController],
      providers: [{ provide: CardsService, useValue: mockCardsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<CardsController>(CardsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= PUBLIC =======
  describe('findAll', () => {
    it('should return paginated cards', async () => {
      const fake = { data: [fakeCard], meta: { total: 1 } };
      mockCardsService.findAll.mockResolvedValue(fake);

      const result = await controller.findAll(pagination);
      expect(mockCardsService.findAll).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(fake);
    });
  });

  describe('findOne', () => {
    it('should return one card', async () => {
      mockCardsService.findOne.mockResolvedValue(fakeCard);

      const result = await controller.findOne('1');
      expect(mockCardsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(fakeCard);
    });
  });

  describe('findBySet', () => {
    it('should return cards filtered by set', async () => {
      const fake = { data: [fakeCard], meta: { total: 1 } };
      mockCardsService.findBySet.mockResolvedValue(fake);

      const result = await controller.findBySet('1', pagination);
      expect(mockCardsService.findBySet).toHaveBeenCalledWith(1, pagination);
      expect(result).toEqual(fake);
    });
  });

  // ======= ADMIN =======
  describe('create', () => {
    it('should create a card with file', async () => {
      const dto = {
        name: 'Dragon',
        rarity: Rarity.RARE,
        type: Type.MONSTER,
        atk: 100,
        hp: 200,
        cardSetId: 1,
      };
      mockCardsService.create.mockResolvedValue(fakeCard);

      const result = await controller.create(fakeFile, dto);
      expect(mockCardsService.create).toHaveBeenCalledWith(fakeFile, dto);
      expect(result).toEqual(fakeCard);
    });

    it('should create a card with imageId from library', async () => {
      const dto = {
        name: 'Dragon',
        rarity: Rarity.RARE,
        type: Type.MONSTER,
        atk: 100,
        hp: 200,
        cardSetId: 1,
        imageId: 1,
      };
      mockCardsService.create.mockResolvedValue(fakeCard);

      const result = await controller.create(undefined as any, dto);
      expect(mockCardsService.create).toHaveBeenCalledWith(undefined, dto);
      expect(result).toEqual(fakeCard);
    });

    it('should create a card without image', async () => {
      const dto = {
        name: 'Dragon',
        rarity: Rarity.RARE,
        type: Type.MONSTER,
        atk: 100,
        hp: 200,
        cardSetId: 1,
      };
      mockCardsService.create.mockResolvedValue(fakeCard);

      await controller.create(undefined as any, dto);
      expect(mockCardsService.create).toHaveBeenCalledWith(undefined, dto);
    });
  });

  describe('update', () => {
    it('should update a card without new file', async () => {
      const dto = { name: 'Dragon Updated' };
      mockCardsService.update.mockResolvedValue({
        ...fakeCard,
        name: 'Dragon Updated',
      });

      const result = await controller.update('1', undefined as any, dto); // ✅ cast ajouté
      expect(mockCardsService.update).toHaveBeenCalledWith(1, undefined, dto);
    });
  });

  describe('remove', () => {
    it('should delete a card', async () => {
      mockCardsService.remove.mockResolvedValue({
        message: 'Card with ID 1 has been deleted',
      });

      const result = await controller.remove('1');
      expect(mockCardsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Card with ID 1 has been deleted' });
    });
  });
});
