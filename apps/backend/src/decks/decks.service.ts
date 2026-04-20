import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';
import { Card } from '../cards/card.entity';
import { CreateDeckDto } from './dto/create-deck.dto';

const MIN_DECK_SIZE = 20;
const MAX_DECK_SIZE = 40;
const MAX_COPIES = 3;

@Injectable()
export class DecksService {
  constructor(
    @InjectRepository(Deck) private deckRepo: Repository<Deck>,
    @InjectRepository(DeckCard) private deckCardRepo: Repository<DeckCard>,
    @InjectRepository(Card) private cardRepo: Repository<Card>,
    private dataSource: DataSource,
  ) {}

  async findAllByUser(userId: number): Promise<Deck[]> {
    return this.deckRepo.find({ where: { userId } });
  }

  async findOne(id: number, userId: number): Promise<Deck> {
    const deck = await this.deckRepo.findOne({ where: { id } });
    if (!deck) throw new NotFoundException(`Deck #${id} introuvable`);
    if (deck.userId !== userId) throw new ForbiddenException();
    return deck;
  }

  /**
   * Load a deck with full card objects, ready for a fight.
   * Returns the flat list of cards (respecting quantities).
   */
  async loadDeckCards(deckId: number, userId: number): Promise<Card[]> {
    const deck = await this.findOne(deckId, userId);
    const cards: Card[] = [];
    for (const entry of deck.deckCards) {
      for (let i = 0; i < entry.quantity; i++) {
        cards.push(entry.card);
      }
    }
    return cards;
  }

  async create(userId: number, dto: CreateDeckDto): Promise<Deck> {
    // Validate total size
    const total = dto.cards.reduce((sum, c) => sum + c.quantity, 0);
    if (total < MIN_DECK_SIZE || total > MAX_DECK_SIZE) {
      throw new BadRequestException(
        `Un deck doit contenir entre ${MIN_DECK_SIZE} et ${MAX_DECK_SIZE} cartes (total actuel : ${total})`,
      );
    }

    // Validate individual copy limits
    const offender = dto.cards.find((c) => c.quantity > MAX_COPIES);
    if (offender) {
      throw new BadRequestException(
        `Maximum ${MAX_COPIES} exemplaires de la même carte (cardId ${offender.cardId})`,
      );
    }

    // Validate all cards exist
    const cardIds = dto.cards.map((c) => c.cardId);
    const foundCards = await this.cardRepo.findByIds(cardIds);
    if (foundCards.length !== cardIds.length) {
      throw new BadRequestException('Une ou plusieurs cartes sont introuvables');
    }

    return this.dataSource.transaction(async (manager) => {
      const deck = manager.create(Deck, { name: dto.name, userId });
      const saved = await manager.save(Deck, deck);

      const deckCards = dto.cards.map((entry) =>
        manager.create(DeckCard, {
          deckId: saved.id,
          cardId: entry.cardId,
          quantity: entry.quantity,
        }),
      );
      await manager.save(DeckCard, deckCards);

      return manager.findOneOrFail(Deck, { where: { id: saved.id } });
    });
  }

  async update(id: number, userId: number, dto: CreateDeckDto): Promise<Deck> {
    await this.findOne(id, userId); // ownership check

    const total = dto.cards.reduce((sum, c) => sum + c.quantity, 0);
    if (total < MIN_DECK_SIZE || total > MAX_DECK_SIZE) {
      throw new BadRequestException(
        `Un deck doit contenir entre ${MIN_DECK_SIZE} et ${MAX_DECK_SIZE} cartes`,
      );
    }

    const offender = dto.cards.find((c) => c.quantity > MAX_COPIES);
    if (offender) {
      throw new BadRequestException(
        `Maximum ${MAX_COPIES} exemplaires de la même carte (cardId ${offender.cardId})`,
      );
    }

    const cardIds = dto.cards.map((c) => c.cardId);
    const foundCards = await this.cardRepo.findByIds(cardIds);
    if (foundCards.length !== cardIds.length) {
      throw new BadRequestException('Une ou plusieurs cartes sont introuvables');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(DeckCard, { deckId: id });
      await manager.update(Deck, { id }, { name: dto.name });

      const deckCards = dto.cards.map((entry) =>
        manager.create(DeckCard, {
          deckId: id,
          cardId: entry.cardId,
          quantity: entry.quantity,
        }),
      );
      await manager.save(DeckCard, deckCards);
      return manager.findOneOrFail(Deck, { where: { id } });
    });
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    const deck = await this.findOne(id, userId);
    await this.deckRepo.remove(deck);
    return { message: `Deck #${id} supprimé` };
  }
}
