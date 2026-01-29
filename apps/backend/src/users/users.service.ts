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
  findOne(id: number) {
    return this.userRepository.findOneBy({ id });
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
}
