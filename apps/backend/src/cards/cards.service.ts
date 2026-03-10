import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './card.entity';
import { Rarity } from './enums/rarity.enum';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ImagesService } from '../images/images.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Image } from '../images/image.entity';
@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    private imagesService: ImagesService,
  ) {}

  async findAll({ page = 1, limit = 20 }: PaginationDto = {}) {
    const [cards, total] = await this.cardRepository.findAndCount({
      relations: { cardSet: true, image: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: cards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const card = await this.cardRepository.findOne({
      where: { id },
      relations: { cardSet: true, image: true },
    });
    if (!card) throw new NotFoundException(`Card with ID ${id} not found`);
    return card;
  }

  async create(file: Express.Multer.File, dto: CreateCardDto) {
    const { cardSetId, imageId, ...cardData } = dto; // ← destructure les ids

    let image: Image | undefined = undefined;
    if (file) {
      image = await this.imagesService.uploadAndSave(file, dto.name);
    } else if (imageId) {
      image = await this.imagesService.findOne(imageId);
    }

    const card = this.cardRepository.create({
      ...cardData,
      cardSet: { id: cardSetId } as any,
      image,
    });
    return this.cardRepository.save(card);
  }

  async update(id: number, file: Express.Multer.File, dto: UpdateCardDto) {
    const card = await this.findOne(id);
    const { cardSetId, imageId, ...cardData } = dto; // ← destructure les ids

    if (file) {
      card.image = await this.imagesService.uploadAndSave(
        file,
        dto.name ?? card.name,
      );
    } else if (imageId) {
      card.image = await this.imagesService.findOne(imageId);
    }

    if (cardSetId) card.cardSet = { id: cardSetId } as any;
    Object.assign(card, cardData); // ← plus d'imageId ni cardSetId dans le spread
    return this.cardRepository.save(card);
  }

  async remove(id: number) {
    const card = await this.findOne(id);
    await this.cardRepository.remove(card);
    return { message: `Card with ID ${id} has been deleted` };
  }

  async findBySet(setId: number, { page = 1, limit = 20 }: PaginationDto = {}) {
    const [cards, total] = await this.cardRepository.findAndCount({
      where: { cardSet: { id: setId } },
      relations: { cardSet: true, image: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: cards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByRarity(
    rarity: Rarity,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [cards, total] = await this.cardRepository.findAndCount({
      where: { rarity },
      relations: { cardSet: true, image: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: cards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
