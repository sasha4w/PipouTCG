import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, EntityManager } from 'typeorm';

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
    if (!user) throw new NotFoundException('User not found');

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
  async saveResetToken(userId: number, token: string, expiry: Date) {
    await this.userRepository.update(userId, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });
  }

  async findByResetToken(token: string) {
    return this.userRepository.findOneBy({ resetToken: token });
  }

  async updatePassword(userId: number, hashedPassword: string) {
    await this.userRepository.update(userId, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });
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
    const [
      [userCards, totalCards],
      [boosters, totalBoosters],
      [bundles, totalBundles],
    ] = await Promise.all([
      this.userCardRepository.findAndCount({
        where: { user: { id: userId }, quantity: MoreThan(0) },
        relations: { card: { cardSet: true } },
        take: 20,
        order: { id: 'ASC' },
      }),
      this.userBoosterRepository.findAndCount({
        where: { user: { id: userId } },
        relations: { booster: true },
        take: 20,
      }),
      this.userBundleRepository.findAndCount({
        where: { user: { id: userId } },
        relations: { bundle: true },
        take: 20,
      }),
    ]);

    return {
      cards: {
        data: userCards.map((uc) => ({
          id: uc.card.id,
          name: uc.card.name,
          rarity: uc.card.rarity,
          atk: uc.card.atk,
          hp: uc.card.hp,
          type: uc.card.type,
          set: uc.card.cardSet?.name,
          setId: uc.card.cardSet?.id,
          quantity: uc.quantity,
        })),
        meta: {
          total: totalCards,
          page: 1,
          limit: 20,
          totalPages: Math.ceil(totalCards / 20),
        },
      },
      boosters: {
        data: boosters.map((ub) => ({
          id: ub.booster.id,
          name: ub.booster.name,
          price: ub.booster.price,
          quantity: ub.quantity,
        })),
        meta: {
          total: totalBoosters,
          page: 1,
          limit: 20,
          totalPages: Math.ceil(totalBoosters / 20),
        },
      },
      bundles: {
        data: bundles.map((ub) => ({
          id: ub.bundle.id,
          name: ub.bundle.name,
          price: ub.bundle.price,
          quantity: ub.quantity,
        })),
        meta: {
          total: totalBundles,
          page: 1,
          limit: 20,
          totalPages: Math.ceil(totalBundles / 20),
        },
      },
    };
  }

  async getCardPortfolio(
    userId: number,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [userCards, total] = await this.userCardRepository.findAndCount({
      where: { user: { id: userId } },
      relations: { card: { cardSet: true } },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: userCards.map((uc) => ({
        id: uc.card.id,
        name: uc.card.name,
        rarity: uc.card.rarity,
        atk: uc.card.atk,
        hp: uc.card.hp,
        type: uc.card.type,
        set: uc.card.cardSet?.name,
        setId: uc.card.cardSet?.id,
        quantity: uc.quantity,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCardsOwned(
    userId: number,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [userCards, total] = await this.userCardRepository.findAndCount({
      where: { user: { id: userId }, quantity: MoreThan(0) },
      relations: { card: { cardSet: true } },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: userCards.map((uc) => ({
        id: uc.card.id,
        name: uc.card.name,
        rarity: uc.card.rarity,
        atk: uc.card.atk,
        hp: uc.card.hp,
        type: uc.card.type,
        set: uc.card.cardSet?.name,
        setId: uc.card.cardSet?.id,
        quantity: uc.quantity,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
  async getUserBoosters(
    userId: number,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [boosters, total] = await this.userBoosterRepository.findAndCount({
      where: { user: { id: userId } },
      relations: { booster: true },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: boosters.map((ub) => ({
        id: ub.booster.id,
        name: ub.booster.name,
        price: ub.booster.price,
        quantity: ub.quantity,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserBundles(
    userId: number,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [bundles, total] = await this.userBundleRepository.findAndCount({
      where: { user: { id: userId } },
      relations: { bundle: true },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: bundles.map((ub) => ({
        id: ub.bundle.id,
        name: ub.bundle.name,
        price: ub.bundle.price,
        quantity: ub.quantity,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
  /* ===================== CARD MANAGEMENT ===================== */
  async addCardToUser(
    userId: number,
    cardId: number,
    quantity = 1,
    manager?: EntityManager, // ← optionnel pour les transactions
  ) {
    const repo = manager
      ? manager.getRepository(UserCard)
      : this.userCardRepository;

    const existing = await repo.findOne({
      where: { user: { id: userId }, card: { id: cardId } },
    });

    if (existing) {
      existing.quantity += quantity;
      return repo.save(existing);
    }

    return repo.save(
      repo.create({
        user: { id: userId } as any,
        card: { id: cardId } as any,
        quantity,
      }),
    );
  }

  /* ===================== BUNDLE MANAGEMENT ===================== */

  async addBundleToUser(userId: number, bundleId: number, quantity = 1) {
    const existing = await this.userBundleRepository.findOne({
      where: { user: { id: userId }, bundle: { id: bundleId } },
    });

    if (existing) {
      existing.quantity += quantity;
      return this.userBundleRepository.save(existing);
    }

    return this.userBundleRepository.save(
      this.userBundleRepository.create({
        user: { id: userId } as any,
        bundle: { id: bundleId } as any,
        quantity,
      }),
    );
  }
  async removeBundleFromUser(
    userId: number,
    bundleId: number,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(UserBundle)
      : this.userBundleRepository;

    const ub = await repo.findOne({
      where: { user: { id: userId }, bundle: { id: bundleId } },
    });

    if (!ub || ub.quantity <= 0) {
      throw new BadRequestException('Vous ne possédez pas ce bundle.');
    }

    ub.quantity--;

    if (ub.quantity <= 0) {
      await repo.remove(ub);
      return null;
    }
    return repo.save(ub);
  }
  async distributeBundleContents(userId: number, contents: any[]) {
    const summary = {
      cards: [] as { name: string; quantity: number }[],
      boosters: [] as { name: string; quantity: number }[],
    };

    for (const content of contents) {
      if (content.card) {
        // Ajout de la carte (gère déjà l'incrémentation si existante)
        await this.addCardToUser(userId, content.card.id, content.quantity);
        summary.cards.push({
          name: content.card.name,
          quantity: content.quantity,
        });
      }

      if (content.booster) {
        // Ajout du booster (gère déjà l'incrémentation si existante)
        await this.addBoosterToUser(
          userId,
          content.booster.id,
          content.quantity,
        );
        summary.boosters.push({
          name: content.booster.name,
          quantity: content.quantity,
        });
      }
    }

    return summary;
  }

  /* ===================== BOOSTER MANAGEMENT ===================== */

  async addBoosterToUser(
    userId: number,
    boosterId: number,
    quantity = 1,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(UserBooster)
      : this.userBoosterRepository;

    const existing = await repo.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });

    if (existing) {
      existing.quantity += quantity;
      return repo.save(existing);
    }

    return repo.save(
      repo.create({
        user: { id: userId } as any,
        booster: { id: boosterId } as any,
        quantity,
      }),
    );
  }

  async removeBoosterFromUser(
    userId: number,
    boosterId: number,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(UserBooster)
      : this.userBoosterRepository;

    const ub = await repo.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });

    if (!ub || ub.quantity <= 0) {
      throw new BadRequestException("L'utilisateur ne possède pas ce booster.");
    }

    ub.quantity--;

    if (ub.quantity <= 0) {
      await repo.remove(ub);
      return null;
    }
    return repo.save(ub);
  }

  async updatePostOpeningStats(userId: number, xpAmount: number) {
    await this.userRepository.increment({ id: userId }, 'boostersOpened', 1);
    await this.userRepository.increment({ id: userId }, 'experience', xpAmount);
  }

  /* ===================== STATS ===================== */

  async addExperience(userId: number, amount: number) {
    await this.userRepository.increment({ id: userId }, 'experience', amount);
  }
  async addGold(userId: number, amount: number) {
    await this.userRepository.increment({ id: userId }, 'gold', amount);
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
  /* ===================== PURCHASES ===================== */

  async spendGoldAndRecordPurchase(userId: number, goldAmount: number) {
    // Utilisation du QueryBuilder pour faire les 3 actions en UNE seule requête SQL
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        // On retire l'or
        gold: () => `gold - ${goldAmount}`,
        // On ajoute aux statistiques de dépenses totales
        moneySpent: () => `moneySpent + ${goldAmount}`,
        // On incrémente le compteur de boosters achetés
        boostersBought: () => `boostersBought + 1`,
      })
      .where('id = :id', { id: userId })
      .execute();
  }
  async spendGoldAndRecordBundlePurchase(userId: number, goldAmount: number) {
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        gold: () => `gold - ${goldAmount}`,
        moneySpent: () => `moneySpent + ${goldAmount}`,
        bundlesBought: () => `bundlesBought + 1`, // Stat spécifique au bundle
      })
      .where('id = :id', { id: userId })
      .execute();
  }
}
