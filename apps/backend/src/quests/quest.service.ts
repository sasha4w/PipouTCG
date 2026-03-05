import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { Quest, QuestCondition } from './quest.entity';
import {
  UserQuest,
  QuestProgress,
  ConditionProgress,
} from '../users/user-quest.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import {
  QuestResetType,
  RewardType,
  ConditionOperator,
} from './enums/quest.enums';

@Injectable()
export class QuestService {
  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,

    @InjectRepository(UserQuest)
    private userQuestRepository: Repository<UserQuest>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(UserCard)
    private userCardRepository: Repository<UserCard>,

    @InjectRepository(UserBooster)
    private userBoosterRepository: Repository<UserBooster>,

    @InjectRepository(UserBundle)
    private userBundleRepository: Repository<UserBundle>,
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

  // Appelé au login : assigne les nouvelles quêtes et reset les expirées
  async syncUserQuests(userId: number) {
    await this.resetExpiredQuests(userId);
    await this.assignMissingQuests(userId);
  }

  // Reset les quêtes expirées (resetAt dans le passé)
  private async resetExpiredQuests(userId: number) {
    const now = new Date();

    const expired = await this.userQuestRepository.find({
      where: {
        user: { id: userId },
        resetAt: LessThan(now),
      },
      relations: { quest: true },
    });

    for (const uq of expired) {
      uq.progress = this.initProgress(uq.quest);
      uq.isCompleted = false;
      uq.rewardClaimed = false;
      uq.completedAt = null;
      uq.resetAt = this.computeNextReset(uq.quest);
      await this.userQuestRepository.save(uq);
    }
  }

  // Assigne les quêtes actives que l'user n'a pas encore
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

    if (newUserQuests.length > 0) {
      await this.userQuestRepository.save(newUserQuests);
    }
  }

  async getUserQuests(userId: number) {
    const userQuests = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
      order: { assignedAt: 'DESC' },
    });

    return userQuests.map((uq) => ({
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
      if (condition.current >= condition.target) {
        condition.completed = true;
      }
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

  // Calcule la prochaine date de reset selon le type
  private computeNextReset(quest: Quest): Date | null {
    if (quest.resetType === QuestResetType.NONE) return null;

    const now = new Date();
    const resetHour = quest.resetHour ?? 4;
    const next = new Date(now);

    switch (quest.resetType) {
      case QuestResetType.DAILY:
        // Prochain jour à resetHour
        next.setDate(next.getDate() + 1);
        next.setHours(resetHour, 0, 0, 0);
        break;

      case QuestResetType.WEEKLY: {
        // Prochain resetDayOfWeek à resetHour
        const targetDay = quest.resetDayOfWeek ?? 1; // lundi par défaut
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        next.setHours(resetHour, 0, 0, 0);
        break;
      }

      case QuestResetType.MONTHLY:
        // 1er du mois prochain à resetHour
        next.setMonth(next.getMonth() + 1, 1);
        next.setHours(resetHour, 0, 0, 0);
        break;
    }

    return next;
  }

  private async distributeReward(userId: number, quest: Quest) {
    switch (quest.rewardType) {
      case RewardType.GOLD:
        await this.userRepository.increment(
          { id: userId },
          'gold',
          Number(quest.rewardAmount),
        );
        break;

      case RewardType.BOOSTER: {
        const existing = await this.userBoosterRepository.findOne({
          where: { user: { id: userId }, booster: { id: quest.rewardItemId } },
        });
        if (existing) {
          existing.quantity += Number(quest.rewardAmount);
          await this.userBoosterRepository.save(existing);
        } else {
          const newEntry = this.userBoosterRepository.create({
            user: { id: userId },
            booster: { id: quest.rewardItemId },
            quantity: Number(quest.rewardAmount),
          });
          await this.userBoosterRepository.save(newEntry);
        }
        break;
      }

      case RewardType.BUNDLE: {
        const existing = await this.userBundleRepository.findOne({
          where: { user: { id: userId }, bundle: { id: quest.rewardItemId } },
        });
        if (existing) {
          existing.quantity += Number(quest.rewardAmount);
          await this.userBundleRepository.save(existing);
        } else {
          const newEntry = this.userBundleRepository.create({
            user: { id: userId },
            bundle: { id: quest.rewardItemId },
            quantity: Number(quest.rewardAmount),
          });
          await this.userBundleRepository.save(newEntry);
        }
        break;
      }
    }
  }
}
