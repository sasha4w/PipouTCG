import { Test, TestingModule } from '@nestjs/testing';
import { QuestController } from './quests.controller';
import { QuestService } from './quests.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import {
  QuestResetType,
  RewardType,
  ConditionOperator,
  ConditionType,
} from './enums/quest.enums';

const mockQuestService = {
  syncUserQuests: jest.fn().mockResolvedValue([]),
  getUserQuests: jest.fn(),
  claimReward: jest.fn(),
  findAllQuests: jest.fn(),
  findOneQuest: jest.fn(),
  createQuest: jest.fn(),
  updateQuest: jest.fn(),
  toggleQuestActive: jest.fn(),
  deleteQuest: jest.fn(),
};

const fakeQuest = {
  id: 1,
  title: 'Ouvre 3 boosters',
  description: 'Ouvre 3 boosters pour compléter la quête',
  resetType: QuestResetType.DAILY,
  rewardType: RewardType.GOLD,
  rewardAmount: 100,
  isActive: true,
  conditionGroup: {
    operator: ConditionOperator.AND,
    conditions: [{ type: ConditionType.OPEN_BOOSTER, amount: 3 }],
  },
};

const fakeUserQuest = {
  id: 1,
  questId: 1,
  title: 'Ouvre 3 boosters',
  isCompleted: false,
  rewardClaimed: false,
};

describe('QuestController', () => {
  let controller: QuestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestController],
      providers: [{ provide: QuestService, useValue: mockQuestService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<QuestController>(QuestController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= CONNECTÉ =======
  describe('getMyQuests', () => {
    it('should return quests for current user', async () => {
      const req = { user: { userId: 1 } };
      mockQuestService.getUserQuests.mockResolvedValue([fakeUserQuest]);

      const result = await controller.getMyQuests(req);
      expect(mockQuestService.getUserQuests).toHaveBeenCalledWith(1);
      expect(result).toEqual([fakeUserQuest]);
    });
  });

  describe('claimReward', () => {
    it('should claim reward for completed quest', async () => {
      const req = { user: { userId: 1 } };
      const fake = { ...fakeUserQuest, rewardClaimed: true };
      mockQuestService.claimReward.mockResolvedValue(fake);

      const result = await controller.claimReward(1, req);
      expect(mockQuestService.claimReward).toHaveBeenCalledWith(1, 1);
      expect(result.rewardClaimed).toBe(true);
    });
  });

  // ======= ADMIN =======
  describe('findAll', () => {
    it('should return all quests', async () => {
      mockQuestService.findAllQuests.mockResolvedValue([fakeQuest]);

      const result = await controller.findAll();
      expect(mockQuestService.findAllQuests).toHaveBeenCalled();
      expect(result).toEqual([fakeQuest]);
    });
  });

  describe('findOne', () => {
    it('should return one quest', async () => {
      mockQuestService.findOneQuest.mockResolvedValue(fakeQuest);

      const result = await controller.findOne(1);
      expect(mockQuestService.findOneQuest).toHaveBeenCalledWith(1);
      expect(result).toEqual(fakeQuest);
    });
  });

  describe('create', () => {
    it('should create a quest', async () => {
      const dto = {
        title: 'Ouvre 3 boosters',
        resetType: QuestResetType.DAILY,
        rewardType: RewardType.GOLD,
        rewardAmount: 100,
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: [{ type: ConditionType.OPEN_BOOSTER, amount: 3 }],
        },
      };
      mockQuestService.createQuest.mockResolvedValue(fakeQuest);

      const result = await controller.create(dto as any);
      expect(mockQuestService.createQuest).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fakeQuest);
    });
  });

  describe('update', () => {
    it('should update a quest', async () => {
      const dto = { title: 'Ouvre 5 boosters' };
      mockQuestService.updateQuest.mockResolvedValue({ ...fakeQuest, ...dto });

      const result = await controller.update(1, dto as any);
      expect(mockQuestService.updateQuest).toHaveBeenCalledWith(1, dto);
      expect(result.title).toBe('Ouvre 5 boosters');
    });
  });

  describe('toggleActive', () => {
    it('should toggle quest active status', async () => {
      mockQuestService.toggleQuestActive.mockResolvedValue({
        ...fakeQuest,
        isActive: false,
      });

      const result = await controller.toggleActive(1);
      expect(mockQuestService.toggleQuestActive).toHaveBeenCalledWith(1);
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete a quest', async () => {
      mockQuestService.deleteQuest.mockResolvedValue(fakeQuest);

      await controller.remove(1);
      expect(mockQuestService.deleteQuest).toHaveBeenCalledWith(1);
    });
  });
});
