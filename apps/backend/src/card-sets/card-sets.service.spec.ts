import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CardSetsService } from './card-sets.service';
import { CardSet } from './card-set.entity';

const mockCardSetRepo = {
  findAndCount: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const fakeCardSet = { id: 1, name: 'Set Fire' };

describe('CardSetsService', () => {
  let service: CardSetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardSetsService,
        { provide: getRepositoryToken(CardSet), useValue: mockCardSetRepo },
      ],
    }).compile();

    service = module.get<CardSetsService>(CardSetsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated card sets', async () => {
      mockCardSetRepo.findAndCount.mockResolvedValue([[fakeCardSet], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([fakeCardSet]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should use default pagination if not provided', async () => {
      mockCardSetRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return card set if found', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue(fakeCardSet);

      const result = await service.findOne(1);
      expect(result).toEqual(fakeCardSet);
    });

    it('should throw NotFoundException if not found', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= CREATE =======
  describe('create', () => {
    it('should create and save card set', async () => {
      const dto = { name: 'Set Fire' };
      mockCardSetRepo.create.mockReturnValue(fakeCardSet);
      mockCardSetRepo.save.mockResolvedValue(fakeCardSet);

      const result = await service.create(dto);
      expect(mockCardSetRepo.create).toHaveBeenCalledWith(dto);
      expect(mockCardSetRepo.save).toHaveBeenCalledWith(fakeCardSet);
      expect(result).toEqual(fakeCardSet);
    });
  });

  // ======= UPDATE =======
  describe('update', () => {
    it('should update name and save card set', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue({ ...fakeCardSet });
      mockCardSetRepo.save.mockResolvedValue({ id: 1, name: 'Set Updated' });

      const result = await service.update(1, { name: 'Set Updated' });
      expect(mockCardSetRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Set Updated');
    });

    it('should not change name if not provided', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue({ ...fakeCardSet });
      mockCardSetRepo.save.mockResolvedValue(fakeCardSet);

      const result = await service.update(1, {});
      expect(result.name).toBe('Set Fire'); // nom inchangé
    });

    it('should throw NotFoundException if card set not found', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update(999, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should remove card set and return message', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue(fakeCardSet);
      mockCardSetRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);
      expect(mockCardSetRepo.remove).toHaveBeenCalledWith(fakeCardSet);
      expect(result).toEqual({
        message: 'Card Set with ID 1 has been deleted',
      });
    });

    it('should throw NotFoundException if card set not found', async () => {
      mockCardSetRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
