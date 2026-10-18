import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  AchievementFamily,
  AchievementTier,
} from '@pipou/shared';
import { AchievementsService } from './achievements.service';
import { buildAchievementsResponse } from './achievement-progress';

const zeroValues = () =>
  Object.fromEntries(
    Object.values(AchievementFamily).map((f) => [f, 0]),
  ) as Record<AchievementFamily, number>;

describe('buildAchievementsResponse', () => {
  it('résout ALL_SETS, marque atteint/réclamé et compte les paliers réclamés', () => {
    const values = {
      ...zeroValues(),
      [AchievementFamily.SETS_COMPLETED]: 4,
      [AchievementFamily.LEVEL]: 16,
    };
    const res = buildAchievementsResponse(
      values,
      4,
      [{ family: AchievementFamily.LEVEL, tier: AchievementTier.BRONZE }],
      AchievementFamily.LEVEL,
    );

    const sets = res.families.find(
      (f) => f.family === AchievementFamily.SETS_COMPLETED,
    )!;
    expect(sets.tiers.map((t) => t.threshold)).toEqual([1, 3, 4]);
    expect(sets.tiers.every((t) => t.reached)).toBe(true);

    const level = res.families.find(
      (f) => f.family === AchievementFamily.LEVEL,
    )!;
    expect(level.claimedTier).toBe(AchievementTier.BRONZE);
    expect(level.tiers.map((t) => [t.reached, t.claimed])).toEqual([
      [true, true],
      [true, false],
      [false, false],
    ]);
    expect(res).toMatchObject({
      unlocked: 1,
      total: 36,
      equippedTitle: AchievementFamily.LEVEL,
    });
  });
});

describe('AchievementsService', () => {
  const stats = { getValues: jest.fn() };
  const repo = {
    find: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };
  const userRepo = { findOne: jest.fn(), update: jest.fn() };
  const usersService = {
    addGold: jest.fn(),
    addBoosterToUser: jest.fn(),
    addBundleToUser: jest.fn(),
  };
  const service = new AchievementsService(
    repo as never,
    userRepo as never,
    stats as never,
    usersService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findOne.mockResolvedValue({ id: 1, equippedTitle: null });
    repo.find.mockResolvedValue([]);
  });

  const withValue = (family: AchievementFamily, value: number) =>
    stats.getValues.mockResolvedValue({
      values: { ...zeroValues(), [family]: value },
      totalSets: 3,
    });

  it('réclame le bronze atteint et distribue l’or', async () => {
    withValue(AchievementFamily.DUELS_WON, 1);
    const res = await service.claim(1, AchievementFamily.DUELS_WON);
    expect(res.tier).toBe(AchievementTier.BRONZE);
    expect(repo.insert).toHaveBeenCalledWith({
      userId: 1,
      family: AchievementFamily.DUELS_WON,
      tier: AchievementTier.BRONZE,
    });
    expect(usersService.addGold).toHaveBeenCalledWith(1, 100);
  });

  it("réclame l'argent après le bronze et distribue le booster", async () => {
    withValue(AchievementFamily.DUELS_WON, 30);
    repo.find.mockResolvedValue([
      { family: AchievementFamily.DUELS_WON, tier: AchievementTier.BRONZE },
    ]);
    await service.claim(1, AchievementFamily.DUELS_WON);
    expect(usersService.addBoosterToUser).toHaveBeenCalledWith(
      1,
      ACHIEVEMENT_REWARD_BOOSTER_ID,
      1,
    );
  });

  it('refuse un palier non atteint', async () => {
    withValue(AchievementFamily.DUELS_WON, 0);
    await expect(service.claim(1, AchievementFamily.DUELS_WON)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('juge un palier non réclamé sur la valeur actuelle', async () => {
    withValue(AchievementFamily.HIGH_RARITY, 0);
    repo.find.mockResolvedValue([
      { family: AchievementFamily.HIGH_RARITY, tier: AchievementTier.BRONZE },
    ]);
    await expect(
      service.claim(1, AchievementFamily.HIGH_RARITY),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse quand tout est réclamé', async () => {
    withValue(AchievementFamily.LEVEL, 99);
    repo.find.mockResolvedValue(
      [
        AchievementTier.BRONZE,
        AchievementTier.SILVER,
        AchievementTier.GOLD,
      ].map((tier) => ({ family: AchievementFamily.LEVEL, tier })),
    );
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('transforme un doublon SQL en 409 sans distribuer', async () => {
    withValue(AchievementFamily.LEVEL, 5);
    repo.insert.mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }),
    );
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(
      ConflictException,
    );
    expect(usersService.addGold).not.toHaveBeenCalled();
  });

  it('annule le palier si la distribution échoue', async () => {
    withValue(AchievementFamily.LEVEL, 5);
    usersService.addGold.mockRejectedValueOnce(new Error('boom'));
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(
      'boom',
    );
    expect(repo.delete).toHaveBeenCalledWith({
      userId: 1,
      family: AchievementFamily.LEVEL,
      tier: AchievementTier.BRONZE,
    });
  });

  it('relance l’erreur de distribution d’origine si le rollback échoue aussi', async () => {
    withValue(AchievementFamily.LEVEL, 5);
    usersService.addGold.mockRejectedValueOnce(new Error('boom'));
    repo.delete.mockRejectedValueOnce(new Error('delete failed'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(
      'boom',
    );
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('refuse un titre dont l’or n’est pas réclamé', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.setTitle(1, AchievementFamily.LEVEL)).rejects.toThrow(
      BadRequestException,
    );
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('équipe un titre débloqué et permet de le retirer', async () => {
    repo.exists.mockResolvedValue(true);
    await service.setTitle(1, AchievementFamily.LEVEL);
    expect(userRepo.update).toHaveBeenCalledWith(1, {
      equippedTitle: AchievementFamily.LEVEL,
    });
    await service.setTitle(1, null);
    expect(userRepo.update).toHaveBeenLastCalledWith(1, {
      equippedTitle: null,
    });
  });
});
