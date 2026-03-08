import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BoostersService } from './boosters.service';
import { Booster } from './booster.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { BoosterOpenCard } from './booster-open-card.entity';
import { Card } from '../cards/card.entity';
import { UsersService } from '../users/users.service';
import { CardNumber } from './enums/cardnumber.enum';
import { Rarity } from '../cards/enums/rarity.enum';

const mockBoosterRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockOpenHistoryRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockOpenCardRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockCardRepo = {
  find: jest.fn(),
};

const mockUsersService = {
  findOne: jest.fn(),
  spendGoldAndRecordPurchase: jest.fn(),
  addBoosterToUser: jest.fn(),
  removeBoosterFromUser: jest.fn(),
  addCardToUser: jest.fn(),
  updatePostOpeningStats: jest.fn(),
};

// Booster de base réutilisé dans plusieurs tests
const fakeBooster = {
  id: 1,
  name: 'Booster Fire',
  price: 100,
  cardNumber: CardNumber.FIVE,
  cardSet: { id: 1, name: 'Set Fire' },
  openHistories: [],
};

// Cartes de base pour les tests d'ouverture
const fakeCards: Card[] = [
  { id: 1, name: 'Dragon', rarity: Rarity.COMMON } as Card,
  { id: 2, name: 'Phoenix', rarity: Rarity.RARE } as Card,
  { id: 3, name: 'Goblin', rarity: Rarity.COMMON } as Card,
  { id: 4, name: 'Titan', rarity: Rarity.UNCOMMON } as Card,
  { id: 5, name: 'Angel', rarity: Rarity.EPIC } as Card,
];

describe('BoostersService', () => {
  let service: BoostersService;

  // Helper pour setup les mocks d'ouverture de booster
  const setupOpen = (cardNumber: CardNumber) => {
    mockBoosterRepo.findOne.mockResolvedValue({ ...fakeBooster, cardNumber });
    mockUsersService.removeBoosterFromUser.mockResolvedValue(null);
    mockCardRepo.find.mockResolvedValue(fakeCards);
    mockOpenHistoryRepo.create.mockReturnValue({ id: 1 });
    mockOpenHistoryRepo.save.mockResolvedValue({ id: 1 });
    mockOpenCardRepo.create.mockReturnValue({});
    mockOpenCardRepo.save.mockResolvedValue({});
    mockUsersService.addCardToUser.mockResolvedValue(undefined);
    mockUsersService.updatePostOpeningStats.mockResolvedValue(undefined);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoostersService,
        { provide: getRepositoryToken(Booster), useValue: mockBoosterRepo },
        {
          provide: getRepositoryToken(BoosterOpenHistory),
          useValue: mockOpenHistoryRepo,
        },
        {
          provide: getRepositoryToken(BoosterOpenCard),
          useValue: mockOpenCardRepo,
        },
        { provide: getRepositoryToken(Card), useValue: mockCardRepo },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<BoostersService>(BoostersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return paginated boosters', async () => {
      mockBoosterRepo.findAndCount.mockResolvedValue([[fakeBooster], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([fakeBooster]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return booster if found', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster);

      const result = await service.findOne(1);
      expect(result).toEqual(fakeBooster);
    });

    it('should throw NotFoundException if not found', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= CREATE =======
  describe('create', () => {
    it('should create and save booster', async () => {
      const data = {
        name: 'Booster Fire',
        cardNumber: CardNumber.EIGHT,
        cardSetId: 1,
        price: 100,
      };
      mockBoosterRepo.create.mockReturnValue({ id: 1, ...data });
      mockBoosterRepo.save.mockResolvedValue({ id: 1, ...data });

      const result = await service.create(data);
      expect(mockBoosterRepo.create).toHaveBeenCalled();
      expect(mockBoosterRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Booster Fire' });
    });
  });

  // ======= UPDATE =======
  describe('update', () => {
    it('should update and save booster', async () => {
      mockBoosterRepo.findOne.mockResolvedValue({ ...fakeBooster });
      mockBoosterRepo.save.mockResolvedValue({
        ...fakeBooster,
        name: 'Updated',
      });

      const result = await service.update(1, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if booster not found', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should remove booster and return message', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster);
      mockBoosterRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Booster with ID 1 deleted' });
    });
  });

  // ======= BUY BOOSTER =======
  describe('buyBooster', () => {
    it('should buy booster if enough gold', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: 1, gold: 1000 });
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster);
      mockUsersService.spendGoldAndRecordPurchase.mockResolvedValue(undefined);
      mockUsersService.addBoosterToUser.mockResolvedValue(undefined);

      const result = await service.buyBooster(1, 1);
      expect(result.goldSpent).toBe(100);
      expect(result.goldRemaining).toBe(900);
      expect(mockUsersService.spendGoldAndRecordPurchase).toHaveBeenCalledWith(
        1,
        100,
      );
      expect(mockUsersService.addBoosterToUser).toHaveBeenCalledWith(1, 1, 1);
    });

    it('should throw BadRequestException if not enough gold', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: 1, gold: 50 });
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster); // price: 100

      await expect(service.buyBooster(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(service.buyBooster(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if booster not found', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: 1, gold: 1000 });
      mockBoosterRepo.findOne.mockResolvedValue(null);

      await expect(service.buyBooster(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= OPEN BOOSTER - cas d'erreur =======
  describe('openBooster - errors', () => {
    it('should throw BadRequestException if no cards in set', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster);
      mockUsersService.removeBoosterFromUser.mockResolvedValue(null);
      mockCardRepo.find.mockResolvedValue([]);

      await expect(service.openBooster(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if booster not in inventory', async () => {
      mockBoosterRepo.findOne.mockResolvedValue(fakeBooster);
      mockUsersService.removeBoosterFromUser.mockRejectedValue(
        new BadRequestException("L'utilisateur ne possède pas ce booster."),
      );

      await expect(service.openBooster(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ======= OPEN BOOSTER - card counts + garanties =======
  describe('openBooster - card counts & guarantees', () => {
    it('should draw 1 card for CardNumber.ONE', async () => {
      setupOpen(CardNumber.ONE);
      const result = await service.openBooster(1, 1);
      expect(result.cards).toHaveLength(1);
    });

    it('should draw 5 cards for CardNumber.FIVE', async () => {
      setupOpen(CardNumber.FIVE);
      const result = await service.openBooster(1, 1);
      expect(result.cards).toHaveLength(5);
      expect(result.historyId).toBe(1);
      expect(result.booster).toBe('Booster Fire');
      expect(mockUsersService.updatePostOpeningStats).toHaveBeenCalledWith(
        1,
        50,
      );
    });

    it('should draw 8 cards + 1 RARE garantie for CardNumber.EIGHT', async () => {
      setupOpen(CardNumber.EIGHT);
      const result = await service.openBooster(1, 1);
      expect(result.cards).toHaveLength(8);
      expect(result.cards.some((c) => c.rarity === Rarity.RARE)).toBe(true);
    });

    it('should draw 10 cards + 1 RARE + 1 EPIC garanties for CardNumber.TEN', async () => {
      setupOpen(CardNumber.TEN);
      const result = await service.openBooster(1, 1);
      expect(result.cards).toHaveLength(10);
      expect(result.cards.some((c) => c.rarity === Rarity.RARE)).toBe(true);
      expect(result.cards.some((c) => c.rarity === Rarity.EPIC)).toBe(true);
    });
  });
});
