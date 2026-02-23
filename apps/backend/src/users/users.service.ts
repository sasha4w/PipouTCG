import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // équivalent de User::findAll()
  findAll() {
    return this.userRepository.find();
  }

  // équivalent de User::find($id)
  async findOne(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) return null;

    const levelData = this.calculateLevelData(user.experience);

    return {
      ...user,
      ...levelData,
    };
  }
  async findByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }
  async findByUsername(username: string) {
    return this.userRepository.findOneBy({ username });
  }
  // équivalent de User::create()
  create(data: Partial<User>) {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }
  async getCardPortfolio(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        userCards: {
          card: {
            cardSet: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.userCards.map((uc) => ({
      id: uc.card.id,
      name: uc.card.name,
      rarity: uc.card.rarity,
      atk: uc.card.atk,
      hp: uc.card.hp,
      type: uc.card.type,
      set: uc.card.cardSet?.name,
      quantity: uc.quantity,
    }));
  }

  async addExperience(userId: number, amount: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) return null;

    user.experience += amount;

    return this.userRepository.save(user);
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
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) return null;

    const levelData = this.calculateLevelData(user.experience);

    return {
      id: user.id,
      username: user.username,

      level: levelData.level,
      experience: user.experience,
      currentXp: levelData.currentXp,
      xpForNextLevel: levelData.xpForNextLevel,
      progressPercent: levelData.progressPercent,

      gold: user.gold,

      stats: {
        boostersOpened: user.boostersOpened,
        cardsBought: user.cardsBought,
        cardsSold: user.cardsSold,
        moneyEarned: user.moneyEarned,
        setsCompleted: user.setsCompleted,
      },
    };
  }
}
