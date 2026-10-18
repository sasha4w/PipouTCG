import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuestService } from './quests.service';
import { Quest } from './quest.entity';
import { UserQuest } from '../users/user-quest.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import {
  QuestResetType,
  QuestRewardType as RewardType,
  ConditionOperator,
  QuestConditionType as ConditionType,
} from '@pipou/shared';
import type { CreateQuestDto } from './dto/create-quest.dto';

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
  remove: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
  increment: jest.fn(),
};

const mockEmitter = { emit: jest.fn() };

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
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventEmitter2, useValue: mockEmitter },
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

      const dto: CreateQuestDto = {
        title: 'Ouvre 3 boosters',
        resetType: QuestResetType.DAILY,
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: [{ type: ConditionType.OPEN_BOOSTER, amount: 3 }],
        },
        rewardType: RewardType.GOLD,
        rewardAmount: 100,
      };
      const result = await service.createQuest(dto);
      expect(mockQuestRepo.create).toHaveBeenCalled();
      expect(result).toEqual(fakeQuest);
    });
  });

  describe('updateQuest', () => {
    it('should update quest', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue({ ...fakeQuest });
      mockQuestRepo.save.mockResolvedValue({ ...fakeQuest, title: 'Updated' });

      const result = await service.updateQuest(1, { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if quest not found', async () => {
      mockQuestRepo.findOneBy.mockResolvedValue(null);

      await expect(service.updateQuest(999, {})).rejects.toThrow(
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
    it('groupe par type et expose relance + resets', async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        {
          ...fakeUserQuest,
          id: 1,
          quest: { ...fakeQuest, resetType: QuestResetType.DAILY },
        },
        {
          ...fakeUserQuest,
          id: 2,
          quest: { ...fakeQuest, resetType: QuestResetType.WEEKLY },
        },
      ]);
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        lastQuestRerollAt: null,
      });
      const res = await service.getUserQuests(1);
      expect(res.DAILY.map((q) => q.id)).toEqual([1]);
      expect(res.WEEKLY.map((q) => q.id)).toEqual([2]);
      expect(res.rerollAvailable).toBe(true);
      expect(res.dailyResetAt).toBeInstanceOf(Date);
      expect(res).not.toHaveProperty('ACHIEVEMENT');
    });
  });

  // ← ajouté dans computeNextReset
  it('should return endDate for EVENT reset type', () => {
    const endDate = new Date('2026-12-31');
    const quest = {
      ...fakeQuest,
      resetType: QuestResetType.EVENT,
      endDate,
    } as Quest;
    const result = service['computeNextReset'](quest);
    expect(result).toEqual(endDate);
  });

  it('should return null for EVENT with no endDate', () => {
    const quest = {
      ...fakeQuest,
      resetType: QuestResetType.EVENT,
      endDate: null,
    } as Quest;
    const result = service['computeNextReset'](quest);
    expect(result).toBeNull();
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
      const result = service['computeNextReset'](quest);
      expect(result).toBeNull();
    });

    it('should return the next 4am for DAILY reset type', () => {
      const result = service['computeNextReset']({
        ...fakeQuest,
        resetType: QuestResetType.DAILY,
      } as Quest);
      expect(result!.getHours()).toBe(4);
      expect(result!.getTime()).toBeGreaterThan(Date.now());
      expect(result!.getTime() - Date.now()).toBeLessThanOrEqual(
        24 * 3_600_000,
      );
    });

    it('should return next month 1st for MONTHLY reset type', () => {
      const quest = {
        ...fakeQuest,
        resetType: QuestResetType.MONTHLY,
        resetHour: 4,
      } as Quest;
      const result = service['computeNextReset'](quest);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(1);
    });
  });

  // ======= ÉVÉNEMENTS DE BOÎTE DE RÉCEPTION =======
  describe('événements de boîte de réception', () => {
    it("émet quest.completed quand une quête vient d'être terminée", async () => {
      const uq = {
        ...fakeUserQuest,
        id: 42,
        quest: {
          ...fakeQuest,
          title: 'Ouvre 3 boosters',
          rewardType: RewardType.GOLD,
          rewardAmount: 100,
        },
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

      await service.track(7, ConditionType.OPEN_BOOSTER, { amount: 1 });

      expect(mockEmitter.emit).toHaveBeenCalledWith('quest.completed', {
        userId: 7,
        userQuestId: 42,
        title: 'Ouvre 3 boosters',
        rewardType: RewardType.GOLD,
        rewardAmount: 100,
      });
    });

    it("n'émet rien tant que la quête n'est pas terminée", async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        structuredClone(fakeUserQuest),
      ]);
      await service.track(7, ConditionType.OPEN_BOOSTER, { amount: 1 });
      expect(mockEmitter.emit).not.toHaveBeenCalledWith(
        'quest.completed',
        expect.anything(),
      );
    });

    it('émet quest.claimed à la réclamation', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue({
        ...fakeUserQuest,
        id: 42,
        isCompleted: true,
        rewardClaimed: false,
      });
      mockUserQuestRepo.save.mockResolvedValue({});
      await service.claimReward(7, 42);
      expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', {
        userId: 7,
        userQuestIds: [42],
      });
    });

    it('émet quest.claimed pour toutes les quêtes de claimAllRewards', async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        { ...fakeUserQuest, id: 1, isCompleted: true, rewardClaimed: false },
        { ...fakeUserQuest, id: 2, isCompleted: true, rewardClaimed: false },
      ]);
      mockUserQuestRepo.save.mockResolvedValue({});
      await service.claimAllRewards(7);
      expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', {
        userId: 7,
        userQuestIds: [1, 2],
      });
    });
  });

  describe('tirage du pool', () => {
    const poolQuest = (id: number, resetType = QuestResetType.DAILY) => ({
      ...fakeQuest,
      id,
      resetType,
    });

    it('tire 3 quêtes distinctes quand le joueur n’en a aucune en cours', async () => {
      mockUserQuestRepo.find.mockResolvedValue([]);
      mockQuestRepo.find.mockImplementation(
        ({ where }: { where: { resetType?: string } }) =>
          Promise.resolve(
            where?.resetType === QuestResetType.DAILY
              ? [1, 2, 3, 4, 5].map((id) => poolQuest(id))
              : [],
          ),
      );
      mockUserQuestRepo.create.mockImplementation((x: object) => x);

      await service['redrawPool'](1, QuestResetType.DAILY);

      const calls = mockUserQuestRepo.save.mock.calls as [
        { quest: { id: number } }[],
      ][];
      const saved = calls[0][0];
      expect(saved).toHaveLength(3);
      expect(new Set(saved.map((s) => s.quest.id)).size).toBe(3);
    });

    it('ne retire pas tant qu’une quête du type est en cours', async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        {
          ...fakeUserQuest,
          resetAt: new Date(Date.now() + 3_600_000),
          quest: poolQuest(1),
        },
      ]);
      await service['redrawPool'](1, QuestResetType.DAILY);
      expect(mockUserQuestRepo.save).not.toHaveBeenCalled();
      expect(mockUserQuestRepo.remove).not.toHaveBeenCalled();
    });

    it('auto-réclame une quête expirée terminée puis la remplace', async () => {
      const expired = {
        ...fakeUserQuest,
        id: 9,
        isCompleted: true,
        rewardClaimed: false,
        resetAt: new Date(Date.now() - 1000),
        quest: poolQuest(1),
      };
      mockUserQuestRepo.find.mockResolvedValue([expired]);
      mockQuestRepo.find.mockResolvedValue([poolQuest(2)]);
      mockUserQuestRepo.create.mockImplementation((x: object) => x);

      const claimed = await service['redrawPool'](1, QuestResetType.DAILY);

      expect(mockUsersService.addGold).toHaveBeenCalledWith(1, 100);
      expect(claimed).toHaveLength(1);
      expect(mockUserQuestRepo.remove).toHaveBeenCalledWith([expired]);
      expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', {
        userId: 1,
        userQuestIds: [9],
      });
    });
  });

  describe('rerollQuest', () => {
    const held = (id: number, questId: number, extra = {}) => ({
      ...fakeUserQuest,
      id,
      resetAt: new Date(Date.now() + 3_600_000),
      quest: { ...fakeQuest, id: questId, resetType: QuestResetType.DAILY },
      ...extra,
    });

    it('remplace par une quête du pool non détenue et consomme la relance', async () => {
      const target = held(1, 10);
      mockUserQuestRepo.findOne.mockResolvedValue(target);
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        lastQuestRerollAt: null,
      });
      mockUserQuestRepo.find.mockResolvedValue([target, held(2, 11)]);
      mockQuestRepo.find.mockResolvedValue(
        [10, 11, 12].map((id) => ({ ...fakeQuest, id })),
      );
      mockUserQuestRepo.save.mockImplementation((x: unknown) =>
        Promise.resolve(x),
      );

      const res = await service.rerollQuest(1, 1);

      expect(res.quest.id).toBe(12);
      expect(res.resetAt).toEqual(target.resetAt);
      expect(mockUserRepo.update).toHaveBeenCalledWith(1, {
        lastQuestRerollAt: expect.any(Date) as Date,
      });
    });

    it('refuse une quête terminée', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(
        held(1, 10, { isCompleted: true }),
      );
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse si la relance du jour est utilisée', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(held(1, 10));
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        lastQuestRerollAt: new Date(),
      });
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse si le pool est épuisé', async () => {
      const target = held(1, 10);
      mockUserQuestRepo.findOne.mockResolvedValue(target);
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        lastQuestRerollAt: null,
      });
      mockUserQuestRepo.find.mockResolvedValue([target]);
      mockQuestRepo.find.mockResolvedValue([{ ...fakeQuest, id: 10 }]);
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('404 si la quête n’appartient pas au joueur', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(null);
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
