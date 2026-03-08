import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuestService } from './quest.service';
import { Quest } from './quest.entity';
import { UserQuest } from '../users/user-quest.entity';
import { UsersService } from '../users/users.service';
import {
  QuestResetType,
  RewardType,
  ConditionOperator,
  ConditionType,
} from './enums/quest.enums';

// ======= MOCKS =======
const mockQuestRepo = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockUserQuestRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockUsersService = {
  addGold: jest.fn(),
  addBoosterToUser: jest.fn(),
  addBundleToUser: jest.fn(),
};
// ======= FAKE DATA =======
const fakeQuest: Partial<Quest> = {
  id: 1,
  title: 'Ouvre 3 boosters',
  description: 'Ouvre 3 boosters',
  resetType: QuestResetType.DAILY,
  rewardType: RewardType.GOLD,
  rewardAmount: 100,
  rewardItemId: undefined,
  isActive: true,
  resetHour: 4,
  conditionGroup: {
    operator: ConditionOperator.AND,
    conditions: [{ type: ConditionType.OPEN_BOOSTER, amount: 3 }],
  },
};

const fakeUserQuest = {
  id: 1,
  isCompleted: false,
  rewardClaimed: false,
  resetAt: null,
  completedAt: null,
  assignedAt: new Date(),
  quest: fakeQuest,
  progress: {
    operator: ConditionOperator.AND,
    conditions: [
      {
        type: ConditionType.OPEN_BOOSTER,
        current: 0,
        target: 3,
        completed: false,
      },
    ],
    globalCompleted: false,
  },
};

describe('QuestService', () => {
  let service: QuestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestService,
        { provide: getRepositoryToken(Quest), useValue: mockQuestRepo },
        { provide: getRepositoryToken(UserQuest), useValue: mockUserQuestRepo },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<QuestService>(QuestService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= CRUD ADMIN =======
  describe('createQuest', () => {
    it('should create and save quest', async () => {
      mockQuestRepo.create.mockReturnValue(fakeQuest);
      mockQuestRepo.save.mockResolvedValue(fakeQuest);

      const result = await service.createQuest(fakeQuest as any);
      expect(mockQuestRepo.create).toHaveBeenCalled();
      expect(result).toEqual(fakeQuest);
    });
  });

  describe('updateQuest', () => {
    it('should update quest', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue({ ...fakeQuest });
      mockQuestRepo.save.mockResolvedValue({ ...fakeQuest, title: 'Updated' });

      const result = await service.updateQuest(1, { title: 'Updated' } as any);
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if quest not found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(null);

      await expect(service.updateQuest(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteQuest', () => {
    it('should delete quest', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(fakeQuest);
      mockQuestRepo.remove.mockResolvedValue(fakeQuest);

      await service.deleteQuest(1);
      expect(mockQuestRepo.remove).toHaveBeenCalledWith(fakeQuest);
    });

    it('should throw NotFoundException if quest not found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(null);

      await expect(service.deleteQuest(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllQuests', () => {
    it('should return all quests', async () => {
      mockQuestRepo.find.mockResolvedValue([fakeQuest]);

      const result = await service.findAllQuests();
      expect(result).toEqual([fakeQuest]);
    });
  });

  describe('findOneQuest', () => {
    it('should return quest if found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(fakeQuest);

      const result = await service.findOneQuest(1);
      expect(result).toEqual(fakeQuest);
    });

    it('should throw NotFoundException if not found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOneQuest(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleQuestActive', () => {
    it('should toggle isActive to false', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue({
        ...fakeQuest,
        isActive: true,
      });
      mockQuestRepo.save.mockResolvedValue({ ...fakeQuest, isActive: false });

      const result = await service.toggleQuestActive(1);
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if quest not found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(null);

      await expect(service.toggleQuestActive(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======= USER QUESTS =======
  describe('getUserQuests', () => {
    it('should return formatted user quests', async () => {
      mockUserQuestRepo.find.mockResolvedValue([fakeUserQuest]);

      const result = await service.getUserQuests(1);
      expect(result).toHaveLength(1);
      expect(result[0].questId).toBe(1);
      expect(result[0].title).toBe('Ouvre 3 boosters');
      expect(result[0].isCompleted).toBe(false);
    });

    it('should return empty array if no quests', async () => {
      mockUserQuestRepo.find.mockResolvedValue([]);

      const result = await service.getUserQuests(1);
      expect(result).toEqual([]);
    });
  });

  // ======= CLAIM REWARD =======
  describe('claimReward', () => {
    it('should throw NotFoundException if userQuest not found', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(null);

      await expect(service.claimReward(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if quest not completed', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        isCompleted: false,
      });

      await expect(service.claimReward(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if reward already claimed', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        isCompleted: true,
        rewardClaimed: true,
      });

      await expect(service.claimReward(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should claim GOLD reward', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        isCompleted: true,
        rewardClaimed: false,
        quest: { ...fakeQuest, rewardType: RewardType.GOLD },
      });
      mockUsersService.addGold.mockResolvedValue(undefined);
      mockUserQuestRepo.save.mockResolvedValue({
        ...fakeUserQuest,
        rewardClaimed: true,
      });

      const result = await service.claimReward(1, 1);
      expect(result.rewardClaimed).toBe(true);
    });

    it('should claim BOOSTER reward', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        isCompleted: true,
        rewardClaimed: false,
        quest: {
          ...fakeQuest,
          rewardType: RewardType.BOOSTER,
          rewardItemId: 5,
          rewardAmount: 1,
        },
      });
      mockUsersService.addBoosterToUser.mockResolvedValue(undefined);
      mockUserQuestRepo.save.mockResolvedValue({
        ...fakeUserQuest,
        rewardClaimed: true,
      });

      const result = await service.claimReward(1, 1);
      expect(mockUsersService.addBoosterToUser).toHaveBeenCalledWith(1, 5, 1);
      expect(result.rewardClaimed).toBe(true);
    });

    it('should claim BUNDLE reward', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        isCompleted: true,
        rewardClaimed: false,
        quest: {
          ...fakeQuest,
          rewardType: RewardType.BUNDLE,
          rewardItemId: 3,
          rewardAmount: 2,
        },
      });
      mockUsersService.addBundleToUser.mockResolvedValue(undefined);
      mockUserQuestRepo.save.mockResolvedValue({
        ...fakeUserQuest,
        rewardClaimed: true,
      });

      const result = await service.claimReward(1, 1);
      expect(mockUsersService.addBundleToUser).toHaveBeenCalledWith(1, 3, 2);
      expect(result.rewardClaimed).toBe(true);
    });
  });

  // ======= TRACK =======
  describe('track', () => {
    it('should update progress when event matches condition', async () => {
      const uq = {
        ...fakeUserQuest,
        progress: {
          operator: ConditionOperator.AND,
          conditions: [
            {
              type: ConditionType.OPEN_BOOSTER,
              current: 0,
              target: 3,
              completed: false,
            },
          ],
          globalCompleted: false,
        },
      };
      mockUserQuestRepo.find.mockResolvedValue([uq]);
      mockUserQuestRepo.save.mockResolvedValue(uq);

      await service.track(1, ConditionType.OPEN_BOOSTER, { amount: 1 });

      expect(uq.progress.conditions[0].current).toBe(1);
      expect(mockUserQuestRepo.save).toHaveBeenCalled();
    });

    it('should complete quest when all conditions met (AND)', async () => {
      const uq = {
        ...fakeUserQuest,
        isCompleted: false,
        progress: {
          operator: ConditionOperator.AND,
          conditions: [
            {
              type: ConditionType.OPEN_BOOSTER,
              current: 2,
              target: 3,
              completed: false,
            },
          ],
          globalCompleted: false,
        },
      };
      mockUserQuestRepo.find.mockResolvedValue([uq]);
      mockUserQuestRepo.save.mockResolvedValue(uq);

      await service.track(1, ConditionType.OPEN_BOOSTER, { amount: 1 });

      expect(uq.progress.conditions[0].completed).toBe(true);
      expect(uq.progress.globalCompleted).toBe(true);
      expect(uq.isCompleted).toBe(true);
    });

    it('should complete quest when one condition met (OR)', async () => {
      const uq = {
        ...fakeUserQuest,
        isCompleted: false,
        progress: {
          operator: ConditionOperator.OR,
          conditions: [
            {
              type: ConditionType.OPEN_BOOSTER,
              current: 2,
              target: 3,
              completed: false,
            },
            {
              type: ConditionType.BUY_CARD,
              current: 0,
              target: 5,
              completed: false,
            },
          ],
          globalCompleted: false,
        },
      };
      mockUserQuestRepo.find.mockResolvedValue([uq]);
      mockUserQuestRepo.save.mockResolvedValue(uq);

      await service.track(1, ConditionType.OPEN_BOOSTER, { amount: 1 });

      expect(uq.progress.globalCompleted).toBe(true); // OR → une seule suffit
      expect(uq.isCompleted).toBe(true);
    });

    it('should not update if event type does not match', async () => {
      const uq = { ...fakeUserQuest };
      mockUserQuestRepo.find.mockResolvedValue([uq]);

      await service.track(1, ConditionType.WIN_FIGHT, {});

      expect(mockUserQuestRepo.save).not.toHaveBeenCalled();
    });
  });

  // ======= COMPUTE NEXT RESET (via syncUserQuests) =======
  describe('computeNextReset (via resetType)', () => {
    it('should return null for NONE reset type', () => {
      const quest = { ...fakeQuest, resetType: QuestResetType.NONE } as Quest;
      const result = (service as any).computeNextReset(quest);
      expect(result).toBeNull();
    });

    it('should return next day for DAILY reset type', () => {
      const quest = {
        ...fakeQuest,
        resetType: QuestResetType.DAILY,
        resetHour: 4,
      } as Quest;
      const result = (service as any).computeNextReset(quest);
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(4);
    });

    it('should return next month 1st for MONTHLY reset type', () => {
      const quest = {
        ...fakeQuest,
        resetType: QuestResetType.MONTHLY,
        resetHour: 4,
      } as Quest;
      const result = (service as any).computeNextReset(quest);
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(1);
    });
  });
});
