import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';
import { v4 as uuidv4 } from 'uuid';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UserCard } from '../users/user-card.entity';
import { CardInstance } from '../fights/interfaces/game-state.interface';
const MIN_DECK_SIZE = 20;
const MAX_DECK_SIZE = 40;
const MAX_COPIES = 3;

@Injectable()
export class DecksService {
  constructor(
    @InjectRepository(Deck) private deckRepo: Repository<Deck>,
    @InjectRepository(DeckCard) private deckCardRepo: Repository<DeckCard>,
    @InjectRepository(UserCard) private userCardRepo: Repository<UserCard>,
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
  async loadDeckCards(deckId: number, userId: number): Promise<CardInstance[]> {
    const deck = await this.deckRepo.findOne({
      where: { id: deckId, userId },
      relations: ['deckCards', 'deckCards.userCard', 'deckCards.userCard.card'],
    });

    if (!deck) throw new Error('Deck introuvable');

    const cards: CardInstance[] = [];

    for (const deckCard of deck.deckCards) {
      for (let i = 0; i < deckCard.quantity; i++) {
        cards.push({
          instanceId: uuidv4(),
          baseCard: deckCard.userCard.card,
          ownerId: userId,
        });
      }
    }

    return cards;
  }

  private async validateUserCards(
    userId: number,
    dto: CreateDeckDto,
  ): Promise<UserCard[]> {
    // Taille totale
    const total = dto.cards.reduce((sum, c) => sum + c.quantity, 0);
    if (total < MIN_DECK_SIZE || total > MAX_DECK_SIZE) {
      throw new BadRequestException(
        `Un deck doit contenir entre ${MIN_DECK_SIZE} et ${MAX_DECK_SIZE} cartes (total actuel : ${total})`,
      );
    }

    // Limite d'exemplaires
    const offender = dto.cards.find((c) => c.quantity > MAX_COPIES);
    if (offender) {
      throw new BadRequestException(
        `Maximum ${MAX_COPIES} exemplaires de la même carte (userCardId ${offender.userCardId})`,
      );
    }

    // Vérifier que toutes les UserCard existent et appartiennent à l'utilisateur
    const userCardIds = dto.cards.map((c) => c.userCardId);
    const foundUserCards = await this.userCardRepo.find({
      where: { id: In(userCardIds), user: { id: userId } },
      relations: ['card'],
    });

    if (foundUserCards.length !== userCardIds.length) {
      throw new BadRequestException(
        'Une ou plusieurs cartes sont introuvables ou ne vous appartiennent pas',
      );
    }

    // Vérifier que le stock est suffisant
    for (const entry of dto.cards) {
      const uc = foundUserCards.find((c) => c.id === entry.userCardId)!;
      if (uc.quantity < entry.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour la carte #${uc.card.id} (possédé : ${uc.quantity}, demandé : ${entry.quantity})`,
        );
      }
    }

    return foundUserCards;
  }

  async create(userId: number, dto: CreateDeckDto): Promise<Deck> {
    await this.validateUserCards(userId, dto);

    return this.dataSource.transaction(async (manager) => {
      const deck = manager.create(Deck, { name: dto.name, userId });
      const saved = await manager.save(Deck, deck);

      const deckCards = dto.cards.map((entry) =>
        manager.create(DeckCard, {
          deckId: saved.id,
          userCardId: entry.userCardId, // ← userCardId
          quantity: entry.quantity,
        }),
      );
      await manager.save(DeckCard, deckCards);

      return manager.findOneOrFail(Deck, { where: { id: saved.id } });
    });
  }

  async update(id: number, userId: number, dto: CreateDeckDto): Promise<Deck> {
    await this.findOne(id, userId); // ownership check
    await this.validateUserCards(userId, dto);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(DeckCard, { deckId: id });
      await manager.update(Deck, { id }, { name: dto.name });

      const deckCards = dto.cards.map((entry) =>
        manager.create(DeckCard, {
          deckId: id,
          userCardId: entry.userCardId, // ← userCardId
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
