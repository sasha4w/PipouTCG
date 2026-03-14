import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Quest } from './quest.entity';
import {
  UserQuest,
  QuestProgress,
  ConditionProgress,
} from '../users/user-quest.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import {
  QuestResetType,
  RewardType,
  ConditionOperator,
} from './enums/quest.enums';
import { UsersService } from '../users/users.service';

export interface AutoClaimedReward {
  title: string;
  rewardType: string;
  rewardAmount: number;
}

@Injectable()
export class QuestService {
  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,

    @InjectRepository(UserQuest)
    private userQuestRepository: Repository<UserQuest>,

    private usersService: UsersService,
  ) {}

  /* ===================== ADMIN - CRUD ===================== */

  async createQuest(dto: CreateQuestDto) {
    const quest = this.questRepository.create(dto);
    return this.questRepository.save(quest);
  }

  async updateQuest(id: number, dto: UpdateQuestDto) {
    const quest = await this.questRepository.findOneBy({ id });
    if (!quest) throw new NotFoundException('Quest not found');
    Object.assign(quest, dto);
    return this.questRepository.save(quest);
  }

  async deleteQuest(id: number) {
    const quest = await this.questRepository.findOneBy({ id });
    if (!quest) throw new NotFoundException('Quest not found');
    return this.questRepository.remove(quest);
  }

  async findAllQuests() {
    return this.questRepository.find({ order: { id: 'ASC' } });
  }

  async findOneQuest(id: number) {
    const quest = await this.questRepository.findOneBy({ id });
    if (!quest) throw new NotFoundException('Quest not found');
    return quest;
  }

  async toggleQuestActive(id: number) {
    const quest = await this.questRepository.findOneBy({ id });
    if (!quest) throw new NotFoundException('Quest not found');
    quest.isActive = !quest.isActive;
    return this.questRepository.save(quest);
  }

  /* ===================== USER - QUÊTES ===================== */

  async syncUserQuests(userId: number): Promise<AutoClaimedReward[]> {
    const autoClaimedRewards = await this.resetExpiredQuests(userId); // ← récupère les rewards
    await this.assignMissingQuests(userId);
    return autoClaimedRewards;
  }

  private async resetExpiredQuests(
    userId: number,
  ): Promise<AutoClaimedReward[]> {
    const now = new Date();
    const claimed: AutoClaimedReward[] = [];

    const expired = await this.userQuestRepository.find({
      where: { user: { id: userId }, resetAt: LessThan(now) },
      relations: { quest: true },
    });

    for (const uq of expired) {
      // ← auto-claim si complétée mais pas encore réclamée
      if (uq.isCompleted && !uq.rewardClaimed) {
        await this.distributeReward(userId, uq.quest);
        claimed.push({
          title: uq.quest.title,
          rewardType: uq.quest.rewardType,
          rewardAmount: Number(uq.quest.rewardAmount),
        });
      }

      uq.progress = this.initProgress(uq.quest);
      uq.isCompleted = false;
      uq.rewardClaimed = false;
      uq.completedAt = null;
      uq.resetAt = this.computeNextReset(uq.quest);
      await this.userQuestRepository.save(uq);
    }

    return claimed;
  }

  private async assignMissingQuests(userId: number) {
    const allQuests = await this.questRepository.find({
      where: { isActive: true },
    });

    const existing = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
    });

    const existingQuestIds = new Set(existing.map((uq) => uq.quest.id));
    const toAssign = allQuests.filter((q) => !existingQuestIds.has(q.id));

    if (toAssign.length === 0) return; // ← rien à faire

    const newUserQuests = toAssign.map((quest) =>
      this.userQuestRepository.create({
        user: { id: userId },
        quest,
        progress: this.initProgress(quest),
        isCompleted: false,
        rewardClaimed: false,
        resetAt: this.computeNextReset(quest),
      }),
    );

    // ← orIgnore évite le crash si doublon (race condition ou retry)
    await this.userQuestRepository
      .createQueryBuilder()
      .insert()
      .into(UserQuest)
      .values(newUserQuests)
      .orIgnore()
      .execute();
  }

  async getUserQuests(userId: number) {
    const userQuests = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
      order: { assignedAt: 'DESC' },
    });

    const mapped = userQuests.map((uq) => ({
      id: uq.id,
      questId: uq.quest.id,
      title: uq.quest.title,
      description: uq.quest.description,
      resetType: uq.quest.resetType,
      rewardType: uq.quest.rewardType,
      rewardAmount: uq.quest.rewardAmount,
      rewardItemId: uq.quest.rewardItemId,
      progress: uq.progress,
      isCompleted: uq.isCompleted,
      rewardClaimed: uq.rewardClaimed,
      resetAt: uq.resetAt,
    }));

    // ← groupé par type pour le dashboard front
    return {
      DAILY: mapped.filter((q) => q.resetType === QuestResetType.DAILY),
      WEEKLY: mapped.filter((q) => q.resetType === QuestResetType.WEEKLY),
      MONTHLY: mapped.filter((q) => q.resetType === QuestResetType.MONTHLY),
      EVENT: mapped.filter((q) => q.resetType === QuestResetType.EVENT),
      ACHIEVEMENT: mapped.filter((q) => q.resetType === QuestResetType.NONE),
    };
  }

  async claimReward(userId: number, userQuestId: number) {
    const uq = await this.userQuestRepository.findOne({
      where: { id: userQuestId, user: { id: userId } },
      relations: { quest: true },
    });

    if (!uq) throw new NotFoundException('Quest not found');
    if (!uq.isCompleted)
      throw new BadRequestException('Quest not completed yet');
    if (uq.rewardClaimed)
      throw new BadRequestException('Reward already claimed');

    await this.distributeReward(userId, uq.quest);
    uq.rewardClaimed = true;
    return this.userQuestRepository.save(uq);
  }

  /* ===================== TRACKING ===================== */

  async track(
    userId: number,
    eventType: string,
    meta: Record<string, any> = {},
  ) {
    const userQuests = await this.userQuestRepository.find({
      where: { user: { id: userId }, isCompleted: false },
      relations: { quest: true },
    });

    for (const uq of userQuests) {
      const updated = this.updateProgress(uq, eventType, meta);
      if (updated) {
        await this.userQuestRepository.save(uq);
      }
    }
  }

  /* ===================== HELPERS PRIVÉS ===================== */

  private initProgress(quest: Quest): QuestProgress {
    const conditions: ConditionProgress[] = quest.conditionGroup.conditions.map(
      (c) => ({
        type: c.type,
        current: 0,
        target: c.amount ?? 1,
        completed: false,
        rarity: c.rarity,
        setId: c.setId,
        boosterId: c.boosterId,
      }),
    );

    return {
      operator: quest.conditionGroup.operator,
      conditions,
      globalCompleted: false,
    };
  }

  private updateProgress(
    uq: UserQuest,
    eventType: string,
    meta: Record<string, any>,
  ): boolean {
    let changed = false;

    for (const condition of uq.progress.conditions) {
      if (condition.completed) continue;
      if (condition.type !== eventType) continue;
      if (condition.rarity && meta.rarity !== condition.rarity) continue;
      if (condition.setId && meta.setId !== condition.setId) continue;
      if (condition.boosterId && meta.boosterId !== condition.boosterId)
        continue;

      condition.current = Math.min(
        condition.current + (meta.amount ?? 1),
        condition.target,
      );
      if (condition.current >= condition.target) condition.completed = true;
      changed = true;
    }

    if (!changed) return false;

    const { operator, conditions } = uq.progress;
    uq.progress.globalCompleted =
      operator === ConditionOperator.AND
        ? conditions.every((c) => c.completed)
        : conditions.some((c) => c.completed);

    if (uq.progress.globalCompleted && !uq.isCompleted) {
      uq.isCompleted = true;
      uq.completedAt = new Date();
    }

    return true;
  }

  private computeNextReset(quest: Quest): Date | null {
    if (quest.resetType === QuestResetType.NONE) return null;
    if (quest.resetType === QuestResetType.EVENT) {
      return quest.endDate ? new Date(quest.endDate) : null; // ← expire à la date de fin
    }

    const now = new Date();
    const resetHour = quest.resetHour ?? 4;
    const next = new Date(now);

    switch (quest.resetType) {
      case QuestResetType.DAILY:
        next.setDate(next.getDate() + 1);
        next.setHours(resetHour, 0, 0, 0);
        break;

      case QuestResetType.WEEKLY: {
        const targetDay = quest.resetDayOfWeek ?? 1;
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        next.setHours(resetHour, 0, 0, 0);
        break;
      }

      case QuestResetType.MONTHLY:
        next.setMonth(next.getMonth() + 1, 1);
        next.setHours(resetHour, 0, 0, 0);
        break;
    }

    return next;
  }

  private async distributeReward(userId: number, quest: Quest) {
    switch (quest.rewardType) {
      case RewardType.GOLD:
        await this.usersService.addGold(userId, Number(quest.rewardAmount));
        break;
      case RewardType.BOOSTER:
        await this.usersService.addBoosterToUser(
          userId,
          quest.rewardItemId,
          Number(quest.rewardAmount),
        );
        break;
      case RewardType.BUNDLE:
        await this.usersService.addBundleToUser(
          userId,
          quest.rewardItemId,
          Number(quest.rewardAmount),
        );
        break;
    }
  }
}
