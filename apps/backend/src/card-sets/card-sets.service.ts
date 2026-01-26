import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardSet } from './card-set.entity';
import { CreateCardSetDto } from './dto/create-card-set.dto';
import { UpdateCardSetDto } from './dto/update-card-set.dto';

@Injectable()
export class CardSetsService {
  constructor(
    @InjectRepository(CardSet)
    private cardSetRepository: Repository<CardSet>,
  ) {}

  findAll() {
    return this.cardSetRepository.find();
  }

  async findOne(id: number) {
    const cardSet = await this.cardSetRepository.findOneBy({ id });
    if (!cardSet) {
      throw new NotFoundException(`Card Set with ID ${id} not found`);
    }
    return cardSet;
  }

  create(createCardSetDto: CreateCardSetDto) {
    const cardSet = this.cardSetRepository.create(createCardSetDto);
    return this.cardSetRepository.save(cardSet);
  }

  async update(id: number, updateCardSetDto: UpdateCardSetDto) {
    const cardSet = await this.findOne(id);

    if (updateCardSetDto.name) {
      cardSet.name = updateCardSetDto.name;
    }

    return this.cardSetRepository.save(cardSet);
  }

  async remove(id: number) {
    const cardSet = await this.findOne(id);
    await this.cardSetRepository.remove(cardSet);
    return { message: `Card Set with ID ${id} has been deleted` };
  }
}
