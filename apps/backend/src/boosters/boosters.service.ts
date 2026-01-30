import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booster } from './booster.entity';
import { CardNumber } from './enums/cardnumber.enum';

@Injectable()
export class BoostersService {
  constructor(
    @InjectRepository(Booster)
    private boosterRepository: Repository<Booster>,
  ) {}

  // Tous les boosters
  findAll() {
    return this.boosterRepository.find({
      relations: {
        cardSet: true,
      },
    });
  }

  // Booster par ID
  async findOne(id: number) {
    const booster = await this.boosterRepository.findOne({
      where: { id },
      relations: {
        cardSet: true,
        openHistories: true,
      },
    });

    if (!booster) {
      throw new NotFoundException(`Booster with ID ${id} not found`);
    }

    return booster;
  }

  // Créer un booster
  async create(data: {
    name: string;
    cardNumber: CardNumber;
    cardSetId: number;
  }) {
    const booster = this.boosterRepository.create({
      name: data.name,
      cardNumber: data.cardNumber,
      cardSet: { id: data.cardSetId } as any,
    });

    return this.boosterRepository.save(booster);
  }

  // Modifier un booster
  async update(
    id: number,
    data: Partial<{
      name: string;
      cardNumber: CardNumber;
      cardSetId: number;
    }>,
  ) {
    const booster = await this.findOne(id);

    if (data.cardSetId) {
      booster.cardSet = { id: data.cardSetId } as any;
    }

    Object.assign(booster, data);

    return this.boosterRepository.save(booster);
  }

  // Supprimer un booster
  async remove(id: number) {
    const booster = await this.findOne(id);
    await this.boosterRepository.remove(booster);

    return { message: `Booster with ID ${id} deleted` };
  }
}
