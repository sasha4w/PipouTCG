import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './card.entity';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
  ) {}

  // Récupérer toutes les cartes
  findAll() {
    return this.cardRepository.find({
      relations: {
        cardSet: true,
      },
    });
  }

  // Récupérer une carte par ID
  async findOne(id: number) {
    const card = await this.cardRepository.findOne({
      where: { id },
      relations: {
        cardSet: true,
      },
    });

    if (!card) {
      throw new NotFoundException(`Card with ID ${id} not found`);
    }

    return card;
  }

  // Créer une nouvelle carte
  create(data: Partial<Card>) {
    const card = this.cardRepository.create(data);
    return this.cardRepository.save(card);
  }

  // Mettre à jour une carte
  async update(id: number, data: Partial<Card>) {
    const card = await this.findOne(id);
    Object.assign(card, data);
    return this.cardRepository.save(card);
  }

  // Supprimer une carte
  async remove(id: number) {
    const card = await this.findOne(id);
    await this.cardRepository.remove(card);
    return { message: `Card with ID ${id} has been deleted` };
  }

  // Récupérer les cartes par set
  async findBySet(setId: number) {
    return this.cardRepository.find({
      where: { cardSet: { id: setId } },
      relations: {
        cardSet: true,
      },
    });
  }

  // Récupérer les cartes par rareté
  async findByRarity(rarity: string) {
    return this.cardRepository.find({
      where: { rarity },
      relations: {
        cardSet: true,
      },
    });
  }
}
