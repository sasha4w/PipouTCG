import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CardsService } from './cards.service';
import { Card } from './card.entity';
import { ImagesService } from '../images/images.service'; // ← remplace UploadService
import { Rarity } from './enums/rarity.enum';
import { Type } from './enums/cardtype.enum';

const mockCardRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockImagesService = {
  uploadAndSave: jest.fn(),
  findOne: jest.fn(),
};

const fakeImage = {
  id: 1,
  name: 'dragon',
  url: 'https://imgbb.com/dragon.webp',
  deleteHash: 'abc123',
};

const fakeCard: Partial<Card> = {
  id: 1,
  name: 'Dragon',
  rarity: Rarity.RARE,
  type: Type.MONSTER,
  atk: 100,
  hp: 200,
  image: fakeImage as any,
  cardSet: { id: 1 } as any,
};

const fakeFile = {
  fieldname: 'image',
  originalname: 'card.png',
  mimetype: 'image/png',
  buffer: Buffer.from('fake-image'),
  size: 1024,
} as Express.Multer.File;

describe('CardsService', () => {
  let service: CardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        { provide: getRepositoryToken(Card), useValue: mockCardRepo },
        { provide: ImagesService, useValue: mockImagesService }, // ← remplacé
      ],
    }).compile();

    service = module.get<CardsService>(CardsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated cards', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[fakeCard], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([fakeCard]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should use default pagination if not provided', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return card if found', async () => {
      mockCardRepo.findOne.mockResolvedValue(fakeCard);

      const result = await service.findOne(1);
      expect(result).toEqual(fakeCard);
    });

    it('should throw NotFoundException if not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= FIND BY SET =======
  describe('findBySet', () => {
    it('should return cards filtered by set', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[fakeCard], 1]);

      const result = await service.findBySet(1, { page: 1, limit: 20 });
      expect(result.data).toEqual([fakeCard]);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty if set has no cards', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findBySet(999, { page: 1, limit: 20 });
      expect(result.data).toEqual([]);
    });
  });

  // ======= CREATE =======
  describe('create', () => {
    const dto = {
      name: 'Dragon',
      rarity: Rarity.RARE,
      type: Type.MONSTER,
      atk: 100,
      hp: 200,
      cardSetId: 1,
    };

    it('should upload image and create card if file provided', async () => {
      mockImagesService.uploadAndSave.mockResolvedValue(fakeImage);
      mockCardRepo.create.mockReturnValue(fakeCard);
      mockCardRepo.save.mockResolvedValue(fakeCard);

      const result = await service.create(fakeFile, dto);

      expect(mockImagesService.uploadAndSave).toHaveBeenCalledWith(
        fakeFile,
        dto.name,
      );
      expect(mockCardRepo.create).toHaveBeenCalled();
      expect(result).toEqual(fakeCard);
    });

    it('should use existing image from library if imageId provided', async () => {
      mockImagesService.findOne.mockResolvedValue(fakeImage);
      mockCardRepo.create.mockReturnValue(fakeCard);
      mockCardRepo.save.mockResolvedValue(fakeCard);

      await service.create(undefined as any, { ...dto, imageId: 1 });

      expect(mockImagesService.findOne).toHaveBeenCalledWith(1);
      expect(mockImagesService.uploadAndSave).not.toHaveBeenCalled();
    });

    it('should create card without image if no file and no imageId', async () => {
      mockCardRepo.create.mockReturnValue({ ...fakeCard, image: undefined });
      mockCardRepo.save.mockResolvedValue({ ...fakeCard, image: undefined });

      await service.create(undefined as any, dto);

      expect(mockImagesService.uploadAndSave).not.toHaveBeenCalled();
      expect(mockImagesService.findOne).not.toHaveBeenCalled();
      expect(mockCardRepo.save).toHaveBeenCalled();
    });
  });

  // ======= UPDATE =======
  describe('update', () => {
    it('should update image if new file provided', async () => {
      mockCardRepo.findOne.mockResolvedValue({ ...fakeCard });
      mockImagesService.uploadAndSave.mockResolvedValue(fakeImage);
      mockCardRepo.save.mockResolvedValue({ ...fakeCard, image: fakeImage });

      await service.update(1, fakeFile, { name: 'Dragon V2' });

      expect(mockImagesService.uploadAndSave).toHaveBeenCalledWith(
        fakeFile,
        'Dragon V2',
      );
      expect(mockCardRepo.save).toHaveBeenCalled();
    });

    it('should use existing image from library if imageId provided', async () => {
      mockCardRepo.findOne.mockResolvedValue({ ...fakeCard });
      mockImagesService.findOne.mockResolvedValue(fakeImage);
      mockCardRepo.save.mockResolvedValue({ ...fakeCard, image: fakeImage });

      await service.update(1, undefined as any, { imageId: 1 });

      expect(mockImagesService.findOne).toHaveBeenCalledWith(1);
      expect(mockImagesService.uploadAndSave).not.toHaveBeenCalled();
    });

    it('should update card without changing image if no file and no imageId', async () => {
      mockCardRepo.findOne.mockResolvedValue({ ...fakeCard });
      mockCardRepo.save.mockResolvedValue({ ...fakeCard, name: 'Dragon V2' });

      const result = await service.update(1, undefined as any, {
        name: 'Dragon V2',
      });

      expect(mockImagesService.uploadAndSave).not.toHaveBeenCalled();
      expect(result.name).toBe('Dragon V2');
    });

    it('should throw NotFoundException if card not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, undefined as any, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should remove card and return message', async () => {
      mockCardRepo.findOne.mockResolvedValue(fakeCard);
      mockCardRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);
      expect(mockCardRepo.remove).toHaveBeenCalledWith(fakeCard);
      expect(result).toEqual({ message: 'Card with ID 1 has been deleted' });
    });

    it('should throw NotFoundException if card not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= FIND BY RARITY =======
  describe('findByRarity', () => {
    it('should return cards filtered by rarity', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[fakeCard], 1]);

      const result = await service.findByRarity(Rarity.RARE, {
        page: 1,
        limit: 20,
      });
      expect(result.data).toEqual([fakeCard]);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty if no cards match rarity', async () => {
      mockCardRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByRarity(Rarity.LEGENDARY, {});
      expect(result.data).toEqual([]);
    });
  });
});
