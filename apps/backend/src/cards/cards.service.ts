import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './card.entity';
import { Rarity } from './enums/rarity.enum';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { UploadService } from '../upload/upload.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    private uploadService: UploadService,
  ) {}

  // Récupérer toutes les cartes
  async findAll({ page = 1, limit = 20 }: PaginationDto = {}) {
    const [cards, total] = await this.cardRepository.findAndCount({
      relations: { cardSet: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: cards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
  async create(file: Express.Multer.File, dto: CreateCardDto) {
    // Upload image si présente
    const imageUrl = file
      ? await this.uploadService.optimizeAndUpload(file)
      : undefined;

    const card = this.cardRepository.create({
      ...dto,
      cardSet: { id: dto.cardSetId } as any,
      imageUrl, // ← URL retournée par ImgBB
    });
    return this.cardRepository.save(card);
  }

  // Mettre à jour une carte
  async update(id: number, file: Express.Multer.File, dto: UpdateCardDto) {
    const card = await this.findOne(id);

    // Nouvelle image uploadée si présente
    if (file) {
      card.imageUrl = await this.uploadService.optimizeAndUpload(file);
    }

    if (dto.cardSetId) {
      card.cardSet = { id: dto.cardSetId } as any;
    }

    Object.assign(card, dto);
    return this.cardRepository.save(card);
  }

  // Supprimer une carte
  async remove(id: number) {
    const card = await this.findOne(id);
    await this.cardRepository.remove(card);
    return { message: `Card with ID ${id} has been deleted` };
  }

  // Récupérer les cartes par set
  async findBySet(setId: number, { page = 1, limit = 20 }: PaginationDto = {}) {
    const [cards, total] = await this.cardRepository.findAndCount({
      where: { cardSet: { id: setId } },
      relations: { cardSet: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: cards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Récupérer les cartes par rareté
  async findByRarity(
    rarity: Rarity,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [cards, total] = await this.cardRepository.findAndCount({
      where: { rarity },
      relations: { cardSet: true },
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
