import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AchievementTier,
  QuestRewardType,
  nextAchievementTier,
  type AchievementFamily,
  type AchievementReward,
  type AchievementsResponse,
  type ClaimAchievementResponse,
} from '@pipou/shared';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { UserAchievement } from './user-achievement.entity';
import { AchievementStatsService } from './achievement-stats.service';
import { buildAchievementsResponse } from './achievement-progress';

function isDuplicateEntry(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === 'ER_DUP_ENTRY' || e?.driverError?.code === 'ER_DUP_ENTRY';
}

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly repo: Repository<UserAchievement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stats: AchievementStatsService,
    private readonly usersService: UsersService,
  ) {}

  async getAchievements(userId: number): Promise<AchievementsResponse> {
    const [{ values, totalSets }, claimed, user] = await Promise.all([
      this.stats.getValues(userId),
      this.repo.find({ where: { userId }, select: ['family', 'tier'] }),
      this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'equippedTitle'],
      }),
    ]);
    return buildAchievementsResponse(
      values,
      totalSets,
      claimed,
      user?.equippedTitle ?? null,
    );
  }

  /** Réclame le prochain palier de la famille, s'il est atteint. */
  async claim(
    userId: number,
    family: AchievementFamily,
  ): Promise<ClaimAchievementResponse> {
    const { families } = await this.getAchievements(userId);
    const progress = families.find((f) => f.family === family);
    if (!progress) throw new BadRequestException('Succès inconnu.');
    const next = nextAchievementTier(progress);
    if (!next)
      throw new BadRequestException('Tous les paliers sont déjà réclamés.');
    if (!next.reached)
      throw new BadRequestException('Palier pas encore atteint.');

    const row = { userId, family, tier: next.tier };
    try {
      await this.repo.insert(row);
    } catch (err) {
      if (isDuplicateEntry(err))
        throw new ConflictException('Palier déjà réclamé.');
      throw err;
    }
    try {
      await this.distribute(userId, next.reward);
    } catch (err) {
      await this.repo.delete(row);
      throw err;
    }
    return { family, tier: next.tier, reward: next.reward };
  }

  async setTitle(userId: number, family: AchievementFamily | null) {
    if (family !== null) {
      const unlocked = await this.repo.exists({
        where: { userId, family, tier: AchievementTier.GOLD },
      });
      if (!unlocked) throw new BadRequestException('Titre non débloqué.');
    }
    await this.userRepo.update(userId, { equippedTitle: family });
    return { equippedTitle: family };
  }

  private async distribute(userId: number, reward: AchievementReward) {
    switch (reward.type) {
      case QuestRewardType.GOLD:
        return this.usersService.addGold(userId, reward.amount);
      case QuestRewardType.BOOSTER:
        return this.usersService.addBoosterToUser(
          userId,
          reward.itemId!,
          reward.amount,
        );
      case QuestRewardType.BUNDLE:
        return this.usersService.addBundleToUser(
          userId,
          reward.itemId!,
          reward.amount,
        );
    }
  }
}
