import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';
import { LoginStreak } from './login-streak.entity';
import { DailyRewardDefinition } from './daily-reward-definition.entity';
import { MilestoneReward } from './milestone-reward.entity';
import { LoginRewardHistory } from './login-reward-histority.entity';
import { StreakRescue } from './streak-rescue.entity';
import { UsersService } from '../users/users.service';
import {
  DailyRewardType as RewardType,
  stripEmoji,
  type ClaimDailyResult,
  type DailyRewardGain,
  type DailyRewardStatus,
  type RescueStreakResult,
  type StreakView,
} from '@pipou/shared';
import {
  classifyGap,
  cycleDayFor,
  rescueCost,
  shiftDay,
  todayUtc,
  weekNumberFor,
} from './streak-rules';
import {
  CreateDailyRewardDefinitionDto,
  UpdateDailyRewardDefinitionDto,
  CreateMilestoneRewardDto,
  UpdateMilestoneRewardDto,
} from './dto/daily-reward.dto';

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

  private streakView(streak: LoginStreak): StreakView {
    return {
      current: streak.currentStreak,
      longest: streak.longestStreak,
      totalDays: streak.totalDays,
      lastClaimDate: streak.lastClaimDate,
    };
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
      where: { cycleDay, weekNumber: IsNull(), isActive: true },
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
   * 1 jour manqué → rescue_required (rien n'est distribué).
   * 2+ jours manqués → la série repart à J1 dans la même requête (streakLost).
   */
  async claimDaily(userId: number): Promise<ClaimDailyResult> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();
    const gap = classifyGap(streak.lastClaimDate, today);

    if (gap === 'claimed_today') {
      throw new ConflictException(
        "Récompense journalière déjà réclamée aujourd'hui.",
      );
    }
    if (gap === 'rescuable') {
      return {
        status: 'rescue_required',
        message:
          'Tu as manqué un jour. Sauve ta série en gold ou repars de J1.',
        streak: this.streakView(streak),
        rescue: { cost: rescueCost(streak.currentStreak) },
      };
    }

    let streakLost: number | undefined;
    if (gap === 'lost' && streak.currentStreak > 0) {
      streakLost = streak.currentStreak;
    }
    if (gap === 'lost' || gap === 'first') streak.currentStreak = 0;

    const day = streak.currentStreak + 1;
    const cycleDay = cycleDayFor(day);
    const rewardDef = await this.getRewardDefinition(
      cycleDay,
      weekNumberFor(day),
    );
    if (!rewardDef) {
      throw new NotFoundException(
        `Aucune récompense définie pour le jour ${cycleDay}`,
      );
    }

    await this.distributeReward(userId, rewardDef);
    const rewards: DailyRewardGain[] = [
      {
        type: rewardDef.rewardType,
        value: rewardDef.rewardValue,
        quantity: rewardDef.quantity,
        label: stripEmoji(rewardDef.label),
        isMilestone: false,
      },
    ];

    streak.currentStreak = day;
    streak.totalDays += 1;
    streak.longestStreak = Math.max(streak.longestStreak, day);
    streak.lastClaimDate = today;
    streak.cycleDay = cycleDayFor(day + 1);
    await this.streakRepo.save(streak);

    await this.historyRepo.save(
      this.historyRepo.create({
        userId,
        dayNumber: streak.totalDays,
        cycleDay,
        rewardType: rewardDef.rewardType,
        rewardValue: rewardDef.rewardValue,
        quantity: rewardDef.quantity,
        wasPurchased: false,
        isMilestone: false,
      }),
    );

    // Palier : atteint à chaque fois que la série passe le seuil
    const milestone = await this.milestoneRepo.findOne({
      where: { dayThreshold: day, isActive: true },
    });
    if (milestone) {
      await this.distributeReward(userId, milestone);
      rewards.push({
        type: milestone.rewardType,
        value: milestone.rewardValue,
        quantity: milestone.quantity,
        label: stripEmoji(milestone.label),
        isMilestone: true,
      });
      await this.historyRepo.save(
        this.historyRepo.create({
          userId,
          dayNumber: streak.totalDays,
          cycleDay,
          rewardType: milestone.rewardType,
          rewardValue: milestone.rewardValue,
          quantity: milestone.quantity,
          isMilestone: true,
        }),
      );
    }

    return {
      status: 'claimed',
      message: `Jour ${day} réclamé !`,
      streak: this.streakView(streak),
      rewards,
      ...(streakLost ? { streakLost } : {}),
    };
  }

  // ── Rachat de streak ───────────────────────────────────────────────────────

  /** Rachète l'unique jour manqué, uniquement le jour du retour. */
  async rescueStreak(userId: number): Promise<RescueStreakResult> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();

    if (classifyGap(streak.lastClaimDate, today) !== 'rescuable') {
      throw new BadRequestException(
        "Seul un jour manqué peut être racheté, et uniquement aujourd'hui.",
      );
    }

    const cost = rescueCost(streak.currentStreak);
    const user = await this.usersService.findOne(userId);
    if (Number(user.gold) < cost) {
      throw new BadRequestException(
        `Pas assez de gold. Il te faut ${cost}g, tu as ${user.gold}g.`,
      );
    }

    await this.usersService.addGold(userId, -cost);
    await this.rescueRepo.save(
      this.rescueRepo.create({
        userId,
        daysMissed: 1,
        goldSpent: cost,
        streakBefore: streak.currentStreak,
        streakAfter: streak.currentStreak,
      }),
    );

    // Le jour manqué devient « hier » : le claim du jour redevient consécutif
    streak.lastClaimDate = shiftDay(today, -1);
    await this.streakRepo.save(streak);

    return {
      message: `Série sauvée pour ${cost}g ! Tu peux réclamer ta récompense du jour.`,
      goldSpent: cost,
      goldRemaining: Number(user.gold) - cost,
      streak: streak.currentStreak,
    };
  }

  // ── Reset volontaire ───────────────────────────────────────────────────────

  async resetStreak(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    if (classifyGap(streak.lastClaimDate, todayUtc()) !== 'rescuable') {
      throw new BadRequestException(
        "Rien à réinitialiser : ta série n'est pas en danger.",
      );
    }
    streak.currentStreak = 0;
    streak.cycleDay = 1;
    streak.lastClaimDate = null;
    await this.streakRepo.save(streak);
    return { message: 'Série réinitialisée. Tu repars de J1 !' };
  }

  // ── Statut ─────────────────────────────────────────────────────────────────

  async getStatus(userId: number): Promise<DailyRewardStatus> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();
    const gap = classifyGap(streak.lastClaimDate, today);
    const nextDay = gap === 'lost' ? 1 : streak.currentStreak + 1;

    const [nextReward, milestones, dates] = await Promise.all([
      this.getRewardDefinition(cycleDayFor(nextDay), weekNumberFor(nextDay)),
      this.milestoneRepo.find({
        where: { isActive: true },
        order: { dayThreshold: 'ASC' },
      }),
      this.datesSince(userId, today),
    ]);

    return {
      streak: this.streakView(streak),
      nextDay: {
        cycleDay: cycleDayFor(nextDay),
        weekNumber: weekNumberFor(nextDay),
      },
      alreadyClaimed: gap === 'claimed_today',
      rescueAvailable: gap === 'rescuable',
      rescueCost: gap === 'rescuable' ? rescueCost(streak.currentStreak) : null,
      streakAtRisk: gap === 'lost' && streak.currentStreak > 0,
      nextReward: nextReward
        ? {
            type: nextReward.rewardType,
            value: nextReward.rewardValue,
            quantity: nextReward.quantity,
            label: stripEmoji(nextReward.label),
          }
        : null,
      milestones: milestones.map((m) => ({
        dayThreshold: m.dayThreshold,
        type: m.rewardType,
        value: m.rewardValue,
        quantity: m.quantity,
        label: stripEmoji(m.label),
      })),
      ...dates,
    };
  }

  /**
   * Jours réclamés et rachetés depuis min(1er du mois, J-6) :
   * de quoi remplir le calendrier du mois et la semaine du widget.
   */
  private async datesSince(userId: number, today: string) {
    const from = [`${today.slice(0, 8)}01`, shiftDay(today, -6)].sort()[0];
    const since = MoreThanOrEqual(new Date(`${from}T00:00:00Z`));

    const [claims, rescues] = await Promise.all([
      this.historyRepo.find({
        where: { userId, isMilestone: false, claimedAt: since },
        order: { claimedAt: 'ASC' },
      }),
      this.rescueRepo.find({ where: { userId, rescuedAt: since } }),
    ]);

    return {
      claimedDates: [...new Set(claims.map((c) => todayUtc(c.claimedAt)))],
      // Un rachat se fait le jour du retour et couvre la veille
      rescuedDates: rescues.map((r) => shiftDay(todayUtc(r.rescuedAt), -1)),
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
      label: stripEmoji(dto.label),
      quantity: dto.quantity ?? 1,
      isActive: dto.isActive ?? true,
    });
    return this.rewardDefRepo.save(def);
  }

  async updateDefinition(id: number, dto: UpdateDailyRewardDefinitionDto) {
    const def = await this.findOneDefinition(id);
    Object.assign(def, dto);
    if (dto.label !== undefined) def.label = stripEmoji(dto.label);
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

      label: stripEmoji(dto.label) ?? undefined,
    });

    return this.milestoneRepo.save(milestoneInstance);
  }

  async updateMilestone(id: number, dto: UpdateMilestoneRewardDto) {
    const m = await this.findOneMilestone(id);
    Object.assign(m, dto);
    if (dto.label !== undefined) m.label = stripEmoji(dto.label) ?? undefined;
    return this.milestoneRepo.save(m);
  }

  async removeMilestone(id: number) {
    const m = await this.findOneMilestone(id);
    await this.milestoneRepo.remove(m);
    return { message: `Milestone ${id} supprimé` };
  }
}
