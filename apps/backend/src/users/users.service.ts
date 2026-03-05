import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { User } from './user.entity';
import { UserCard } from './user-card.entity';
import { UserBooster } from './user-booster.entity';
import { UserBundle } from './user-bundle.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(UserCard)
    private userCardRepository: Repository<UserCard>,

    @InjectRepository(UserBooster)
    private userBoosterRepository: Repository<UserBooster>,

    @InjectRepository(UserBundle)
    private userBundleRepository: Repository<UserBundle>,
  ) {}

  /* ===================== BASIC ===================== */

  async findAll({ page = 1, limit = 20 }: PaginationDto) {
    const [users, total] = await this.userRepository.findAndCount({
      select: [
        'id',
        'username',
        'email',
        'is_admin',
        'gold',
        'experience',
        'isPrivate',
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'username',
        'email',
        'is_admin',
        'gold',
        'experience',
        'isPrivate',
        'boostersOpened',
        'cardsBought',
        'cardsSold',
        'moneyEarned',
        'setsCompleted',
      ],
    });
    if (!user) return null;

    const levelData = this.calculateLevelData(user.experience);
    return { ...user, ...levelData };
  }

  async findByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }

  async findByUsername(username: string) {
    return this.userRepository.findOneBy({ username });
  }

  create(data: Partial<User>) {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  /* ===================== PRIVACY ===================== */

  async togglePrivacy(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    user.isPrivate = !user.isPrivate;
    await this.userRepository.save(user);

    return { isPrivate: user.isPrivate };
  }

  /* ===================== INVENTORY ===================== */

  async getInventory(userId: number) {
    const [cards, boosters, bundles] = await Promise.all([
      this.getCardsOwned(userId),
      this.getUserBoosters(userId),
      this.getUserBundles(userId),
    ]);

    return { cards, boosters, bundles };
  }

  async getCardPortfolio(userId: number) {
    const userCards = await this.userCardRepository.find({
      where: { user: { id: userId } },
      relations: { card: { cardSet: true } },
    });

    return userCards.map((uc) => ({
      id: uc.card.id,
      name: uc.card.name,
      rarity: uc.card.rarity,
      atk: uc.card.atk,
      hp: uc.card.hp,
      type: uc.card.type,
      set: uc.card.cardSet?.name,
      setId: uc.card.cardSet?.id,
      quantity: uc.quantity,
    }));
  }

  async getCardsOwned(userId: number) {
    const userCards = await this.userCardRepository.find({
      where: { user: { id: userId }, quantity: MoreThan(0) },
      relations: { card: { cardSet: true } },
    });

    return userCards.map((uc) => ({
      id: uc.card.id,
      name: uc.card.name,
      rarity: uc.card.rarity,
      atk: uc.card.atk,
      hp: uc.card.hp,
      type: uc.card.type,
      set: uc.card.cardSet?.name,
      setId: uc.card.cardSet?.id,
      quantity: uc.quantity,
    }));
  }

  async getUserBoosters(userId: number) {
    const boosters = await this.userBoosterRepository.find({
      where: { user: { id: userId } },
      relations: { booster: true },
    });

    return boosters.map((ub) => ({
      id: ub.booster.id,
      name: ub.booster.name,
      price: ub.booster.price,
      quantity: ub.quantity,
    }));
  }

  async getUserBundles(userId: number) {
    const bundles = await this.userBundleRepository.find({
      where: { user: { id: userId } },
      relations: { bundle: true },
    });

    return bundles.map((ub) => ({
      id: ub.bundle.id,
      name: ub.bundle.name,
      price: ub.bundle.price,
      quantity: ub.quantity,
    }));
  }

  /* ===================== BOOSTER MANAGEMENT ===================== */

  async addBoosterToUser(userId: number, boosterId: number, quantity = 1) {
    const existing = await this.userBoosterRepository.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });

    if (existing) {
      existing.quantity += quantity;
      return this.userBoosterRepository.save(existing);
    }

    const newBooster = this.userBoosterRepository.create({
      user: { id: userId },
      booster: { id: boosterId },
      quantity,
    });

    return this.userBoosterRepository.save(newBooster);
  }

  async removeBoosterFromUser(userId: number, boosterId: number) {
    const booster = await this.userBoosterRepository.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });

    if (!booster) throw new NotFoundException('Booster not found in inventory');

    booster.quantity--;

    if (booster.quantity <= 0) {
      await this.userBoosterRepository.remove(booster);
      return null;
    }

    return this.userBoosterRepository.save(booster);
  }

  /* ===================== STATS ===================== */

  async addExperience(userId: number, amount: number) {
    await this.userRepository.increment({ id: userId }, 'experience', amount);
  }

  async incrementBoostersOpened(userId: number) {
    await this.userRepository.increment({ id: userId }, 'boostersOpened', 1);
  }

  async incrementCardsSold(userId: number, amount: number, goldEarned: number) {
    await this.userRepository.increment({ id: userId }, 'cardsSold', amount);
    await this.userRepository.increment(
      { id: userId },
      'moneyEarned',
      goldEarned,
    );
  }

  /* ===================== PROFILE ===================== */

  calculateLevelData(experience: number) {
    let level = 1;
    let xpNeeded = 10;
    let remainingXp = experience;

    while (remainingXp >= xpNeeded) {
      remainingXp -= xpNeeded;
      level++;
      xpNeeded = level * 10;
    }

    return {
      level,
      currentXp: remainingXp,
      xpForNextLevel: xpNeeded,
      progressPercent: Math.floor((remainingXp / xpNeeded) * 100),
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'username',
        'experience',
        'gold',
        'isPrivate',
        'boostersOpened',
        'cardsBought',
        'cardsSold',
        'moneyEarned',
        'setsCompleted',
      ],
    });
    if (!user) return null;

    const levelData = this.calculateLevelData(user.experience);

    return {
      id: user.id,
      username: user.username,
      isPrivate: user.isPrivate,
      level: levelData.level,
      experience: user.experience,
      currentXp: levelData.currentXp,
      xpForNextLevel: levelData.xpForNextLevel,
      progressPercent: levelData.progressPercent,
      gold: Number(user.gold),
      stats: {
        boostersOpened: user.boostersOpened,
        cardsBought: user.cardsBought,
        cardsSold: user.cardsSold,
        moneyEarned: Number(user.moneyEarned),
        setsCompleted: user.setsCompleted,
      },
    };
  }
}
