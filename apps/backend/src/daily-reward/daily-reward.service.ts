import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginStreak } from './login-streak.entity';
import { DailyRewardDefinition } from './daily-reward-definition.entity';
import { MilestoneReward } from './milestone-reward.entity';
import { LoginRewardHistory } from './login-reward-histority.entity';
import { StreakRescue } from './streak-rescue.entity';
import { UsersService } from '../users/users.service';
import { RewardType } from './enums/reward-type.enum';
import {
  CreateDailyRewardDefinitionDto,
  UpdateDailyRewardDefinitionDto,
  CreateMilestoneRewardDto,
  UpdateMilestoneRewardDto,
  RescueStreakDto,
} from './dto/daily-reward.dto';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Renvoie la date d'aujourd'hui au format YYYY-MM-DD (UTC) */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Différence en jours entre deux dates YYYY-MM-DD */
function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}

/**
 * Coût de rachat en gold.
 * - Base : 50g par jour manqué
 * - Discount streak : -2g par jour de streak (max -80g) → fidélité récompensée
 * - Malus temps : x1.3 par jour manqué (max x3) → plus t'attends, plus c'est cher
 */
function calculateRescueCost(
  currentStreak: number,
  daysMissed: number,
): number {
  const base = 50 * daysMissed;
  const discount = Math.min(currentStreak * 2, 80);
  const multiplier = Math.min(1 + daysMissed * 0.3, 3);
  return Math.max(Math.round((base - discount) * multiplier), 10);
}

/** Nombre max de jours rachetables selon la longueur de streak */
function maxRescuableDays(currentStreak: number): number {
  if (currentStreak >= 100) return 5;
  if (currentStreak >= 30) return 3;
  if (currentStreak >= 7) return 2;
  return 1;
}

@Injectable()
export class DailyRewardService {
  constructor(
    @InjectRepository(LoginStreak)
    private streakRepo: Repository<LoginStreak>,
    @InjectRepository(DailyRewardDefinition)
    private rewardDefRepo: Repository<DailyRewardDefinition>,
    @InjectRepository(MilestoneReward)
    private milestoneRepo: Repository<MilestoneReward>,
    @InjectRepository(LoginRewardHistory)
    private historyRepo: Repository<LoginRewardHistory>,
    @InjectRepository(StreakRescue)
    private rescueRepo: Repository<StreakRescue>,
    private readonly usersService: UsersService,
  ) {}

  // ── Streak helpers ─────────────────────────────────────────────────────────

  /** Récupère ou crée la streak d'un utilisateur */
  private async getOrCreateStreak(userId: number): Promise<LoginStreak> {
    let streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) {
      streak = this.streakRepo.create({
        userId,
        currentStreak: 0,
        cycleDay: 1,
        totalDays: 0,
      });
      await this.streakRepo.save(streak);
    }
    return streak;
  }

  /** Avance le cycleDay de 1 (boucle 1-7) */
  private nextCycleDay(current: number): number {
    return (current % 7) + 1;
  }

  // ── Récompense courante ────────────────────────────────────────────────────

  /**
   * Retourne la définition de récompense pour un cycleDay et un numéro de semaine donnés.
   * Priorité : définition spécifique à la semaine > définition générique (weekNumber = null).
   */
  private async getRewardDefinition(
    cycleDay: number,
    weekNumber: number,
  ): Promise<DailyRewardDefinition | null> {
    // Cherche d'abord une définition spécifique à cette semaine
    const specific = await this.rewardDefRepo.findOne({
      where: { cycleDay, weekNumber, isActive: true },
    });
    if (specific) return specific;

    // Fallback sur la définition générique
    return this.rewardDefRepo.findOne({
      where: { cycleDay, weekNumber: null as any, isActive: true },
    });
  }

  /** Distribue effectivement la récompense à l'utilisateur */
  private async distributeReward(
    userId: number,
    rewardDef: DailyRewardDefinition | MilestoneReward,
  ): Promise<void> {
    const { rewardType, rewardValue, quantity } = rewardDef;

    switch (rewardType) {
      case RewardType.GOLD:
        await this.usersService.addGold(userId, rewardValue * quantity);
        break;
      case RewardType.CARD:
        await this.usersService.addCardToUser(userId, rewardValue, quantity);
        break;
      case RewardType.BOOSTER:
        await this.usersService.addBoosterToUser(userId, rewardValue, quantity);
        break;
      case RewardType.BUNDLE:
        await this.usersService.addBundleToUser(userId, rewardValue, quantity);
        break;
    }
  }

  // ── Claim du jour ──────────────────────────────────────────────────────────

  /**
   * Réclame la récompense journalière.
   * Retourne l'état du streak + les récompenses obtenues + info de rachat si applicable.
   */
  async claimDaily(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayStr();

    // Déjà réclamé aujourd'hui
    if (streak.lastClaimDate === today) {
      throw new ConflictException(
        "Récompense journalière déjà réclamée aujourd'hui.",
      );
    }

    const rewards: Array<{
      type: RewardType;
      value: number;
      quantity: number;
      label?: string | null;
      isMilestone: boolean;
    }> = [];
    let rescueInfo: {
      daysMissed: number;
      maxRescuable: number;
      costPerScenario: number[];
    } | null = null;

    if (!streak.lastClaimDate) {
      // Premier claim ever
      streak.currentStreak = 1;
    } else {
      const diff = daysBetween(streak.lastClaimDate, today);

      if (diff === 1) {
        // Connexion consécutive
        streak.currentStreak += 1;
      } else if (diff > 1) {
        // Jours manqués — on informe mais on ne reset pas encore
        // L'utilisateur doit choisir via /rescue ou accepter le reset via /reset
        const missed = diff - 1;
        const maxR = maxRescuableDays(streak.currentStreak);
        const costs = Array.from({ length: Math.min(missed, maxR) }, (_, i) =>
          calculateRescueCost(streak.currentStreak, i + 1),
        );

        return {
          status: 'rescue_required',
          message: `Tu as manqué ${missed} jour(s). Tu peux racheter ta streak en gold ou la réinitialiser.`,
          streak: {
            current: streak.currentStreak,
            longest: streak.longestStreak,
            totalDays: streak.totalDays,
            cycleDay: streak.cycleDay,
          },
          rescue: {
            daysMissed: missed,
            maxRescuable: maxR,
            costPerScenario: costs,
          },
        };
      }
    }

    // Calcule la semaine courante (ex: streak 8 → semaine 2)
    const weekNumber = Math.floor(streak.totalDays / 7) + 1;

    // Récupère la récompense du jour
    const rewardDef = await this.getRewardDefinition(
      streak.cycleDay,
      weekNumber,
    );
    if (!rewardDef) {
      throw new NotFoundException(
        `Aucune récompense définie pour le jour ${streak.cycleDay}`,
      );
    }

    // Distribue la récompense principale
    await this.distributeReward(userId, rewardDef);
    rewards.push({
      type: rewardDef.rewardType,
      value: rewardDef.rewardValue,
      quantity: rewardDef.quantity,
      label: rewardDef.label,
      isMilestone: false,
    });

    // Met à jour la streak
    streak.totalDays += 1;
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastClaimDate = today;
    streak.cycleDay = this.nextCycleDay(streak.cycleDay);
    await this.streakRepo.save(streak);

    // Sauvegarde l'historique
    await this.historyRepo.save(
      this.historyRepo.create({
        userId,
        dayNumber: streak.totalDays,
        cycleDay: rewardDef.cycleDay,
        rewardType: rewardDef.rewardType,
        rewardValue: rewardDef.rewardValue,
        quantity: rewardDef.quantity,
        wasPurchased: false,
        isMilestone: false,
      }),
    );

    // Vérifie les milestones
    const milestone = await this.milestoneRepo.findOne({
      where: { dayThreshold: streak.totalDays, isActive: true },
    });
    if (milestone) {
      await this.distributeReward(userId, milestone);
      rewards.push({
        type: milestone.rewardType,
        value: milestone.rewardValue,
        quantity: milestone.quantity,
        label: milestone.label,
        isMilestone: true,
      });
      await this.historyRepo.save(
        this.historyRepo.create({
          userId,
          dayNumber: streak.totalDays,
          cycleDay: streak.cycleDay,
          rewardType: milestone.rewardType,
          rewardValue: milestone.rewardValue,
          quantity: milestone.quantity,
          wasPurchased: false,
          isMilestone: true,
        }),
      );
    }

    return {
      status: 'claimed',
      message: `Jour ${streak.totalDays} réclamé !`,
      streak: {
        current: streak.currentStreak,
        longest: streak.longestStreak,
        totalDays: streak.totalDays,
        cycleDay: streak.cycleDay,
      },
      rewards,
    };
  }

  // ── Rachat de streak ───────────────────────────────────────────────────────

  async rescueStreak(userId: number, dto: RescueStreakDto) {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayStr();

    if (!streak.lastClaimDate) {
      throw new BadRequestException('Aucune streak à sauvegarder.');
    }

    const diff = daysBetween(streak.lastClaimDate, today);
    if (diff <= 1) {
      throw new BadRequestException("Ta streak n'est pas en danger.");
    }

    const missed = diff - 1;
    const maxR = maxRescuableDays(streak.currentStreak);

    if (dto.daysToBuy > maxR) {
      throw new BadRequestException(
        `Tu ne peux racheter que ${maxR} jour(s) maximum avec ta streak actuelle de ${streak.currentStreak}.`,
      );
    }
    if (dto.daysToBuy > missed) {
      throw new BadRequestException(`Tu n'as manqué que ${missed} jour(s).`);
    }

    const cost = calculateRescueCost(streak.currentStreak, dto.daysToBuy);
    const user = await this.usersService.findOne(userId);
    if (Number(user.gold) < cost) {
      throw new BadRequestException(
        `Pas assez de gold. Il te faut ${cost}g, tu as ${user.gold}g.`,
      );
    }

    // Débite le gold
    await this.usersService.addGold(userId, -cost);

    // Sauvegarde le rescue
    await this.rescueRepo.save(
      this.rescueRepo.create({
        userId,
        daysMissed: dto.daysToBuy,
        goldSpent: cost,
        streakBefore: streak.currentStreak,
        streakAfter: streak.currentStreak, // streak maintenue
      }),
    );

    // Recule lastClaimDate pour que le claim du jour soit possible
    const newLastClaim = new Date();
    newLastClaim.setDate(newLastClaim.getDate() - 1);
    streak.lastClaimDate = newLastClaim.toISOString().slice(0, 10);
    await this.streakRepo.save(streak);

    return {
      message: `Streak sauvegardée pour ${cost}g ! Tu peux maintenant réclamer ta récompense du jour.`,
      goldSpent: cost,
      goldRemaining: Number(user.gold) - cost,
      streak: streak.currentStreak,
    };
  }

  // ── Reset volontaire ───────────────────────────────────────────────────────

  async resetStreak(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    streak.currentStreak = 1;
    streak.cycleDay = 1;
    streak.lastClaimDate = null;
    await this.streakRepo.save(streak);
    return { message: 'Streak réinitialisée. Tu repars de J1 !' };
  }

  // ── Statut ─────────────────────────────────────────────────────────────────

  async getStatus(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayStr();
    const alreadyClaimed = streak.lastClaimDate === today;

    let daysMissed = 0;
    let rescueAvailable = false;
    if (streak.lastClaimDate && !alreadyClaimed) {
      const diff = daysBetween(streak.lastClaimDate, today);
      if (diff > 1) {
        daysMissed = diff - 1;
        rescueAvailable = daysMissed <= maxRescuableDays(streak.currentStreak);
      }
    }

    const weekNumber = Math.floor(streak.totalDays / 7) + 1;
    const nextReward = await this.getRewardDefinition(
      streak.cycleDay,
      weekNumber,
    );

    // Prochain milestone
    const nextMilestone = await this.milestoneRepo
      .createQueryBuilder('m')
      .where('m.dayThreshold > :total AND m.isActive = true', {
        total: streak.totalDays,
      })
      .orderBy('m.dayThreshold', 'ASC')
      .getOne();

    return {
      streak: {
        current: streak.currentStreak,
        longest: streak.longestStreak,
        totalDays: streak.totalDays,
        cycleDay: streak.cycleDay,
        weekNumber,
      },
      alreadyClaimed,
      daysMissed,
      rescueAvailable,
      rescueCost:
        daysMissed > 0
          ? calculateRescueCost(
              streak.currentStreak,
              Math.min(daysMissed, maxRescuableDays(streak.currentStreak)),
            )
          : null,
      maxRescuable: maxRescuableDays(streak.currentStreak),
      nextReward: nextReward
        ? {
            type: nextReward.rewardType,
            value: nextReward.rewardValue,
            quantity: nextReward.quantity,
            label: nextReward.label,
          }
        : null,
      nextMilestone: nextMilestone
        ? {
            dayThreshold: nextMilestone.dayThreshold,
            daysRemaining: nextMilestone.dayThreshold - streak.totalDays,
            label: nextMilestone.label,
          }
        : null,
    };
  }

  // ── Historique ─────────────────────────────────────────────────────────────

  async getHistory(userId: number, limit = 30) {
    return this.historyRepo.find({
      where: { userId },
      order: { claimedAt: 'DESC' },
      take: limit,
    });
  }

  // ── CRUD Admin : DailyRewardDefinition ────────────────────────────────────

  async findAllDefinitions() {
    return this.rewardDefRepo.find({
      order: { cycleDay: 'ASC', weekNumber: 'ASC' },
    });
  }

  async findOneDefinition(id: number) {
    const def = await this.rewardDefRepo.findOne({ where: { id } });
    if (!def) throw new NotFoundException(`Définition ${id} introuvable`);
    return def;
  }

  async createDefinition(dto: CreateDailyRewardDefinitionDto) {
    const def = this.rewardDefRepo.create({
      ...dto,
      quantity: dto.quantity ?? 1,
      isActive: dto.isActive ?? true,
    });
    return this.rewardDefRepo.save(def);
  }

  async updateDefinition(id: number, dto: UpdateDailyRewardDefinitionDto) {
    const def = await this.findOneDefinition(id);
    Object.assign(def, dto);
    return this.rewardDefRepo.save(def);
  }

  async removeDefinition(id: number) {
    const def = await this.findOneDefinition(id);
    await this.rewardDefRepo.remove(def);
    return { message: `Définition ${id} supprimée` };
  }

  // ── CRUD Admin : MilestoneReward ───────────────────────────────────────────

  async findAllMilestones() {
    return this.milestoneRepo.find({ order: { dayThreshold: 'ASC' } });
  }

  async findOneMilestone(id: number) {
    const m = await this.milestoneRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`Milestone ${id} introuvable`);
    return m;
  }

  async createMilestone(dto: CreateMilestoneRewardDto) {
    const existing = await this.milestoneRepo.findOne({
      where: { dayThreshold: dto.dayThreshold },
    });

    if (existing) {
      throw new ConflictException(
        `Un milestone existe déjà pour J${dto.dayThreshold}`,
      );
    }

    const milestoneInstance = this.milestoneRepo.create({
      dayThreshold: dto.dayThreshold,
      rewardType: dto.rewardType,
      rewardValue: dto.rewardValue,
      quantity: dto.quantity ?? 1,
      isActive: dto.isActive ?? true,

      label: dto.label ?? undefined,
    });

    return this.milestoneRepo.save(milestoneInstance);
  }

  async updateMilestone(id: number, dto: UpdateMilestoneRewardDto) {
    const m = await this.findOneMilestone(id);
    Object.assign(m, dto);
    return this.milestoneRepo.save(m);
  }

  async removeMilestone(id: number) {
    const m = await this.findOneMilestone(id);
    await this.milestoneRepo.remove(m);
    return { message: `Milestone ${id} supprimé` };
  }
}
