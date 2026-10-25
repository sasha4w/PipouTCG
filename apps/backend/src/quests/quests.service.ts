import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, Not } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
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
  QuestRewardType as RewardType,
  ConditionOperator,
  QuestConditionType as ConditionType,
  Rarity,
  rarityAtLeast,
  ProductType,
} from '@pipou/shared';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import {
  POOL_DRAW_SIZE,
  drawDistinct,
  isRerollAvailable,
  nextDailyReset,
  nextWeeklyReset,
} from './quest-schedule';

export interface AutoClaimedReward {
  title: string;
  rewardType: string;
  rewardAmount: number;
}

/** Détails d'un événement de jeu, comparés aux filtres des conditions de quête. */
export interface QuestEventMeta {
  amount?: number;
  rarity?: Rarity;
  setId?: number;
  boosterId?: number;
  level?: number;
}

/** Types tirés dans un pool ; les autres sont assignés à tous. */
const POOL_TYPES: QuestResetType[] = [
  QuestResetType.DAILY,
  QuestResetType.WEEKLY,
];

@Injectable()
export class QuestService {
  private syncing = new Map<number, Promise<AutoClaimedReward[]>>();

  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,

    @InjectRepository(UserQuest)
    private userQuestRepository: Repository<UserQuest>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    private usersService: UsersService,

    private eventEmitter: EventEmitter2,
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

  /** Un seul sync à la fois par joueur : deux GET simultanés ne doivent pas tirer deux fois. */
  syncUserQuests(userId: number): Promise<AutoClaimedReward[]> {
    const running = this.syncing.get(userId);
    if (running) return running;
    const job = this.doSync(userId).finally(() => this.syncing.delete(userId));
    this.syncing.set(userId, job);
    return job;
  }

  private async doSync(userId: number): Promise<AutoClaimedReward[]> {
    // Les lignes de quêtes désactivées partent d'abord, sinon elles bloqueraient le tirage.
    const claimed: AutoClaimedReward[] =
      await this.removeInactiveUserQuests(userId);
    for (const type of POOL_TYPES)
      claimed.push(...(await this.redrawPool(userId, type)));
    claimed.push(...(await this.resetExpiredQuests(userId)));
    await this.assignMissingQuests(userId);
    return claimed;
  }

  /** Nouveau tirage du pool `type` quand plus aucune quête de ce type n'est en cours. */
  private async redrawPool(
    userId: number,
    type: QuestResetType,
  ): Promise<AutoClaimedReward[]> {
    const now = new Date();
    const held = await this.userQuestRepository.find({
      where: { user: { id: userId }, quest: { resetType: type } },
      relations: { quest: true },
    });
    const inProgress = held.some(
      (uq) => uq.quest.isActive !== false && uq.resetAt && uq.resetAt > now,
    );
    if (inProgress) return [];

    const claimed = await this.autoClaim(userId, held);
    if (held.length > 0) await this.userQuestRepository.remove(held);

    const pool = await this.questRepository.find({
      where: { resetType: type, isActive: true },
    });
    const drawn = drawDistinct(pool, POOL_DRAW_SIZE);
    if (drawn.length > 0) {
      await this.userQuestRepository.save(
        drawn.map((quest) =>
          this.userQuestRepository.create({
            user: { id: userId },
            quest,
            progress: this.initProgress(quest),
            isCompleted: false,
            rewardClaimed: false,
            resetAt: this.computeNextReset(quest),
          }),
        ),
      );
    }
    return claimed;
  }

  /** Distribue les récompenses terminées mais non réclamées (avant reset ou suppression). */
  private async autoClaim(
    userId: number,
    userQuests: UserQuest[],
  ): Promise<AutoClaimedReward[]> {
    const claimed: AutoClaimedReward[] = [];
    for (const uq of userQuests) {
      if (!uq.isCompleted || uq.rewardClaimed) continue;
      await this.distributeReward(userId, uq.quest);
      claimed.push({
        title: uq.quest.title,
        rewardType: uq.quest.rewardType,
        rewardAmount: Number(uq.quest.rewardAmount),
      });
      this.eventEmitter.emit('quest.claimed', {
        userId,
        userQuestIds: [uq.id],
      });
    }
    return claimed;
  }

  private async removeInactiveUserQuests(
    userId: number,
  ): Promise<AutoClaimedReward[]> {
    const inactiveQuests = await this.questRepository.find({
      where: { isActive: false },
      select: ['id'],
    });

    if (inactiveQuests.length === 0) return [];

    const inactiveQuestIds = inactiveQuests.map((q) => q.id);

    const toDelete = await this.userQuestRepository.find({
      where: {
        user: { id: userId },
        quest: { id: In(inactiveQuestIds) },
      },
      relations: { quest: true },
    });

    if (toDelete.length === 0) return [];

    const claimed = await this.autoClaim(userId, toDelete);
    await this.userQuestRepository.remove(toDelete);
    return claimed;
  }

  private async resetExpiredQuests(
    userId: number,
  ): Promise<AutoClaimedReward[]> {
    const now = new Date();
    const claimed: AutoClaimedReward[] = [];

    const expired = await this.userQuestRepository.find({
      where: {
        user: { id: userId },
        resetAt: LessThan(now),
        quest: { resetType: Not(In(POOL_TYPES)) },
      },
      relations: { quest: true },
    });

    for (const uq of expired) {
      claimed.push(...(await this.autoClaim(userId, [uq])));

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
      where: { isActive: true, resetType: Not(In(POOL_TYPES)) },
    });

    const existing = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
    });

    const existingQuestIds = new Set(existing.map((uq) => uq.quest.id));
    const toAssign = allQuests.filter((q) => !existingQuestIds.has(q.id));

    if (toAssign.length === 0) return;

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

    await this.userQuestRepository
      .createQueryBuilder()
      .insert()
      .into(UserQuest)
      .values(newUserQuests)
      .orIgnore()
      .execute();
  }

  async getUserQuests(userId: number) {
    const now = new Date();
    const [userQuests, user] = await Promise.all([
      this.userQuestRepository.find({
        where: { user: { id: userId } },
        relations: { quest: true },
        order: { assignedAt: 'DESC' },
      }),
      this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'lastQuestRerollAt'],
      }),
    ]);

    const mapped = userQuests.map((uq) => ({
      id: uq.id,
      questId: uq.quest.id,
      title: uq.quest.title,
      description: uq.quest.description ?? null,
      resetType: uq.quest.resetType,
      rewardType: uq.quest.rewardType,
      rewardAmount: Number(uq.quest.rewardAmount),
      rewardItemId: uq.quest.rewardItemId ?? null,
      progress: uq.progress,
      isCompleted: uq.isCompleted,
      rewardClaimed: uq.rewardClaimed,
      resetAt: uq.resetAt,
    }));
    const of = (type: QuestResetType) =>
      mapped.filter((q) => q.resetType === type);

    return {
      DAILY: of(QuestResetType.DAILY),
      WEEKLY: of(QuestResetType.WEEKLY),
      MONTHLY: of(QuestResetType.MONTHLY),
      EVENT: of(QuestResetType.EVENT),
      rerollAvailable: isRerollAvailable(user?.lastQuestRerollAt ?? null, now),
      dailyResetAt: nextDailyReset(now),
      weeklyResetAt: nextWeeklyReset(now),
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
    const saved = await this.userQuestRepository.save(uq);
    this.eventEmitter.emit('quest.claimed', { userId, userQuestIds: [uq.id] });
    return saved;
  }

  async claimAllRewards(userId: number) {
    const claimableQuests = await this.userQuestRepository.find({
      where: {
        user: { id: userId },
        isCompleted: true,
        rewardClaimed: false,
      },
      relations: ['quest'],
    });

    if (claimableQuests.length === 0) return { count: 0 };

    for (const userQuest of claimableQuests) {
      await this.distributeReward(userId, userQuest.quest);
      userQuest.rewardClaimed = true;
      await this.userQuestRepository.save(userQuest);
    }

    this.eventEmitter.emit('quest.claimed', {
      userId,
      userQuestIds: claimableQuests.map((uq) => uq.id),
    });

    return { count: claimableQuests.length };
  }

  /** Remplace une quête daily/hebdo non terminée ; une relance par journée de jeu. */
  async rerollQuest(userId: number, userQuestId: number) {
    const uq = await this.userQuestRepository.findOne({
      where: { id: userQuestId, user: { id: userId } },
      relations: { quest: true },
    });
    if (!uq) throw new NotFoundException('Quest not found');
    if (uq.isCompleted) throw new BadRequestException('Quête déjà terminée.');
    if (!POOL_TYPES.includes(uq.quest.resetType))
      throw new BadRequestException('Cette quête ne peut pas être changée.');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'lastQuestRerollAt'],
    });
    if (!isRerollAvailable(user?.lastQuestRerollAt ?? null, new Date()))
      throw new BadRequestException('Relance du jour déjà utilisée.');

    const held = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
    });
    const heldIds = new Set(held.map((h) => h.quest.id));
    const candidates = (
      await this.questRepository.find({
        where: { resetType: uq.quest.resetType, isActive: true },
      })
    ).filter((q) => !heldIds.has(q.id));
    const [replacement] = drawDistinct(candidates, 1);
    if (!replacement)
      throw new BadRequestException('Aucune autre quête disponible.');

    uq.quest = replacement;
    uq.progress = this.initProgress(replacement);
    uq.rewardClaimed = false;
    uq.completedAt = null;
    const saved = await this.userQuestRepository.save(uq);
    await this.userRepository.update(userId, {
      lastQuestRerollAt: new Date(),
    });
    return saved;
  }

  /* ===================== TRACKING ===================== */

  async track(
    userId: number,
    eventType: ConditionType,
    meta: QuestEventMeta = {},
  ) {
    const userQuests = await this.userQuestRepository.find({
      where: { user: { id: userId }, isCompleted: false },
      relations: { quest: true },
    });

    let completed = 0;
    let dailyCompleted = 0;
    for (const uq of userQuests) {
      const updated = this.updateProgress(uq, eventType, meta);
      if (!updated) continue;
      await this.userQuestRepository.save(uq);
      // track() ne charge que des quêtes non terminées : terminée ici = vient de l'être
      if (uq.isCompleted) {
        completed++;
        if (uq.quest.resetType === QuestResetType.DAILY) dailyCompleted++;
        this.eventEmitter.emit('quest.completed', {
          userId,
          userQuestId: uq.id,
          title: uq.quest.title,
          rewardType: uq.quest.rewardType,
          rewardAmount: Number(uq.quest.rewardAmount),
        });
      }
    }

    if (completed > 0)
      await this.userRepository.increment(
        { id: userId },
        'questsCompleted',
        completed,
      );
    // COMPLETE_QUEST n'existe que dans des quêtes WEEKLY : la récursion s'arrête au 2e appel
    if (dailyCompleted > 0)
      await this.track(userId, ConditionType.COMPLETE_QUEST, {
        amount: dailyCompleted,
      });
  }

  /* ===================== EVENT HANDLERS ===================== */

  @OnEvent('booster.opened')
  async handleBoosterOpened(payload: {
    userId: number;
    boosterId: number;
    setId: number;
    amount: number;
    rarities?: Rarity[];
  }) {
    await this.track(payload.userId, ConditionType.OPEN_BOOSTER, {
      boosterId: payload.boosterId,
      setId: payload.setId,
      amount: payload.amount,
    });

    const byRarity = new Map<Rarity, number>();
    for (const r of payload.rarities ?? [])
      byRarity.set(r, (byRarity.get(r) ?? 0) + 1);
    for (const [rarity, amount] of byRarity) {
      await this.track(payload.userId, ConditionType.OBTAIN_CARD, {
        rarity,
        amount,
        setId: payload.setId,
      });
    }

    await this.checkSetCompletion(payload.userId, payload.setId);
  }

  @OnEvent('booster.bought')
  async handleBoosterBought(payload: {
    userId: number;
    boosterId: number;
    amount: number;
  }) {
    await this.track(payload.userId, ConditionType.BUY_BOOSTER, {
      amount: payload.amount,
    });
  }

  // ✅ Achat de carte sur le marché
  @OnEvent('market.card.bought')
  async handleMarketCardBought(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.BUY_CARD, {
      amount: payload.amount,
    });
  }

  // ✅ Vente de carte sur le marché
  @OnEvent('market.card.sold')
  async handleMarketCardSold(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.SELL_CARD, {
      amount: payload.amount,
    });
  }

  // ✅ Forge de cartes
  @OnEvent('forge.done')
  async handleForgeDone(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.FORGE_CARD, {
      amount: payload.amount,
    });
  }

  // ✅ Destruction de cartes
  @OnEvent('destroy.done')
  async handleDestroyDone(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.DESTROY_CARD, {
      amount: payload.amount,
    });
  }

  // ✅ Achat de booster sur le marché
  @OnEvent('market.booster.bought')
  async handleMarketBoosterBought(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.BUY_BOOSTER, {
      amount: payload.amount,
    });
  }

  // ✅ Vente de booster sur le marché
  @OnEvent('market.booster.sold')
  async handleMarketBoosterSold(payload: { userId: number; amount: number }) {
    await this.track(payload.userId, ConditionType.SELL_BOOSTER, {
      amount: payload.amount,
    });
  }

  // ✅ Vérifie si un set est complété après réception d'une carte
  @OnEvent('card.set.check')
  async handleSetCheck(payload: { userId: number; setId: number }) {
    await this.checkSetCompletion(payload.userId, payload.setId);
  }

  @OnEvent('fight.finished')
  async handleFightFinished(payload: {
    player1Id: number;
    player2Id: number;
    winnerId: number | null;
  }) {
    for (const id of [payload.player1Id, payload.player2Id]) {
      await this.track(id, ConditionType.PLAY_FIGHT);
      await this.track(id, ConditionType.PLAY_PVP_FIGHT);
    }
    if (payload.winnerId !== null) {
      await this.track(payload.winnerId, ConditionType.WIN_FIGHT);
      await this.track(payload.winnerId, ConditionType.WIN_PVP_FIGHT);
    }
  }

  @OnEvent('adventure.finished')
  async handleAdventureFinished(payload: { userId: number; won: boolean }) {
    await this.track(payload.userId, ConditionType.PLAY_FIGHT);
    await this.track(payload.userId, ConditionType.PLAY_PVE_FIGHT);
    if (payload.won) {
      await this.track(payload.userId, ConditionType.WIN_FIGHT);
      await this.track(payload.userId, ConditionType.WIN_PVE_FIGHT);
    }
  }

  @OnEvent('listing.sold')
  async handleListingSold(payload: { sellerId: number; totalPrice: number }) {
    await this.track(payload.sellerId, ConditionType.EARN_GOLD, {
      amount: Number(payload.totalPrice),
    });
  }

  @OnEvent('listing.created')
  async handleListingCreated(payload: {
    sellerId: number;
    productType: string;
  }) {
    if (payload.productType !== ProductType.CARD) return;
    await this.track(payload.sellerId, ConditionType.LIST_CARD);
  }

  @OnEvent('daily-reward.claimed')
  async handleDailyRewardClaimed(payload: { userId: number }) {
    await this.track(payload.userId, ConditionType.CLAIM_DAILY_REWARD);
  }

  /* ===================== HELPERS PUBLICS ===================== */

  // ✅ Vérifie si le user possède toutes les cartes d'un set
  async checkSetCompletion(userId: number, setId: number): Promise<void> {
    const allCardsInSet = await this.questRepository.manager
      .getRepository('card')
      .find({ where: { cardSet: { id: setId } } });

    if (allCardsInSet.length === 0) return;

    const ownedCards = await this.questRepository.manager
      .getRepository('user_card')
      .find({
        where: {
          user: { id: userId },
          card: { cardSet: { id: setId } },
        },
        relations: ['card'],
      });

    const hasAll = ownedCards.length >= allCardsInSet.length;

    if (hasAll) {
      await this.track(userId, ConditionType.COMPLETE_SET, {
        setId,
        amount: 1,
      });
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
        minRarity: c.minRarity,
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
    eventType: ConditionType,
    meta: QuestEventMeta,
  ): boolean {
    let changed = false;

    for (const condition of uq.progress.conditions) {
      if (condition.completed) continue;
      if (condition.type !== eventType) continue;
      if (condition.rarity && meta.rarity !== condition.rarity) continue;
      if (
        condition.minRarity &&
        (!meta.rarity || !rarityAtLeast(meta.rarity, condition.minRarity))
      )
        continue;
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
      return quest.endDate ? new Date(quest.endDate) : null;
    }

    const now = new Date();
    const resetHour = quest.resetHour ?? 4;
    const next = new Date(now);

    switch (quest.resetType) {
      case QuestResetType.DAILY:
        return nextDailyReset(now);

      case QuestResetType.WEEKLY:
        return nextWeeklyReset(now);

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
