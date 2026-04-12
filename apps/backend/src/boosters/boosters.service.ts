import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Booster } from './booster.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { BoosterOpenCard } from './booster-open-card.entity';
import { Card } from '../cards/card.entity';
import { CardNumber } from './enums/cardnumber.enum';
import { Rarity } from '../cards/enums/rarity.enum';
import { UsersService } from '../users/users.service';
import { PaginationDto } from '../common/dto/pagination.dto';

const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 60,
  [Rarity.UNCOMMON]: 25,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 4,
  [Rarity.LEGENDARY]: 0.8,
  [Rarity.SECRET]: 0.2,
};

const BOOSTER_GUARANTEES: Record<number, Rarity[]> = {
  8: [Rarity.RARE], // ← clé number, pas enum
  10: [Rarity.RARE, Rarity.EPIC],
};

// ── Résout "EIGHT" | "8" | 8  →  8
function resolveCardNumber(value: any): number {
  const n = Number(value);
  if (!isNaN(n) && n > 0) return n;
  // MySQL a retourné la clé string de l'enum ("EIGHT", "TEN"…)
  const fromKey = CardNumber[value as keyof typeof CardNumber];
  if (fromKey !== undefined) return Number(fromKey);
  throw new Error(`Impossible de résoudre cardNumber: "${value}"`);
}

@Injectable()
export class BoostersService {
  constructor(
    @InjectRepository(Booster)
    private boosterRepository: Repository<Booster>,
    @InjectRepository(BoosterOpenHistory)
    private openHistoryRepository: Repository<BoosterOpenHistory>,
    @InjectRepository(BoosterOpenCard)
    private openCardRepository: Repository<BoosterOpenCard>,
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    private readonly usersService: UsersService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll({ page = 1, limit = 20 }: PaginationDto = {}) {
    const [boosters, total] = await this.boosterRepository.findAndCount({
      relations: { cardSet: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: boosters,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const booster = await this.boosterRepository.findOne({
      where: { id },
      relations: { cardSet: true, openHistories: true },
    });
    if (!booster)
      throw new NotFoundException(`Booster with ID ${id} not found`);
    return booster;
  }

  async create(data: {
    name: string;
    cardNumber: CardNumber;
    cardSetId: number;
    price: number;
  }) {
    const booster = this.boosterRepository.create({
      name: data.name,
      cardNumber: data.cardNumber,
      price: data.price,
      cardSet: { id: data.cardSetId } as any,
    });
    return this.boosterRepository.save(booster);
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      cardNumber: CardNumber;
      cardSetId: number;
      price: number;
    }>,
  ) {
    const booster = await this.findOne(id);
    if (data.cardSetId) booster.cardSet = { id: data.cardSetId } as any;
    Object.assign(booster, data);
    return this.boosterRepository.save(booster);
  }

  async remove(id: number) {
    const booster = await this.findOne(id);
    await this.boosterRepository.remove(booster);
    return { message: `Booster with ID ${id} deleted` };
  }

  // ── MÉTHODES PRIVÉES DE TIRAGE ────────────────────────────────────────────

  private drawCardOfRarity(
    rarity: Rarity,
    cardsByRarity: Record<Rarity, Card[]>,
  ): Card {
    const rarityOrder: Rarity[] = [
      Rarity.SECRET,
      Rarity.LEGENDARY,
      Rarity.EPIC,
      Rarity.RARE,
      Rarity.UNCOMMON,
      Rarity.COMMON,
    ];

    const startIndex = rarityOrder.indexOf(rarity);
    for (let i = startIndex; i < rarityOrder.length; i++) {
      const pool = cardsByRarity[rarityOrder[i]];
      if (pool?.length) return pool[Math.floor(Math.random() * pool.length)];
    }

    throw new BadRequestException('No card available in any rarity pool');
  }

  private drawCard(cardsByRarity: Record<Rarity, Card[]>): Card {
    const availableWeights = Object.fromEntries(
      Object.entries(RARITY_WEIGHTS).filter(
        ([rarity]) => cardsByRarity[rarity as Rarity]?.length > 0,
      ),
    );

    const totalWeight = Object.values(availableWeights).reduce(
      (sum, w) => sum + w,
      0,
    );
    let roll = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(availableWeights)) {
      roll -= weight;
      if (roll <= 0)
        return this.drawCardOfRarity(rarity as Rarity, cardsByRarity);
    }

    return this.drawCardOfRarity(
      Object.keys(availableWeights)[0] as Rarity,
      cardsByRarity,
    );
  }

  // ── ACHAT ─────────────────────────────────────────────────────────────────

  async buyBooster(boosterId: number, userId: number, quantity = 1) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const booster = await this.findOne(boosterId);
    const totalCost = booster.price * quantity;
    if (Number(user.gold) < totalCost) {
      throw new BadRequestException(
        `Not enough gold. Required: ${totalCost}, available: ${user.gold}`,
      );
    }
    await this.usersService.spendGoldAndRecordPurchase(userId, totalCost);
    await this.usersService.addBoosterToUser(userId, boosterId, quantity);
    this.eventEmitter.emit('booster.bought', {
      userId,
      boosterId,
      amount: quantity,
    });
    return {
      message: `Booster "${booster.name}" acheté avec succès`,
      goldSpent: totalCost,
      goldRemaining: Number(user.gold) - totalCost,
    };
  }

  // ── OUVERTURE ─────────────────────────────────────────────────────────────

  async openBooster(boosterId: number, userId: number) {
    const booster = await this.findOne(boosterId);

    const totalCards = resolveCardNumber(booster.cardNumber);
    const guarantees = BOOSTER_GUARANTEES[totalCards] ?? [];

    const cards = await this.cardRepository.find({
      where: { cardSet: { id: booster.cardSet.id } },
      relations: { image: true },
    });
    if (!cards.length)
      throw new BadRequestException(`No cards in set ${booster.cardSet.name}`);

    const cardsByRarity = cards.reduce(
      (acc, card) => {
        if (!acc[card.rarity]) acc[card.rarity] = [];
        acc[card.rarity].push(card);
        return acc;
      },
      {} as Record<Rarity, Card[]>,
    );

    const drawnCards: Card[] = [];

    for (const rarity of guarantees) {
      drawnCards.push(this.drawCardOfRarity(rarity, cardsByRarity));
    }
    for (let i = drawnCards.length; i < totalCards; i++) {
      drawnCards.push(this.drawCard(cardsByRarity));
    }

    drawnCards.sort(() => Math.random() - 0.5);

    const cardGroups = drawnCards.reduce(
      (acc, card) => {
        acc[card.id] = (acc[card.id] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    let historyId: number;

    await this.openCardRepository.manager.transaction(async (manager) => {
      await this.usersService.removeBoosterFromUser(userId, boosterId, manager);

      const history = await manager.save(
        manager.create(BoosterOpenHistory, {
          user: { id: userId } as any,
          booster: { id: booster.id } as any,
          openedAt: new Date(),
        }),
      );
      historyId = history.id;

      for (const [cardId, quantity] of Object.entries(cardGroups)) {
        await this.usersService.addCardToUser(
          userId,
          Number(cardId),
          quantity,
          manager,
        );

        await manager.save(
          manager.create(BoosterOpenCard, {
            card: { id: Number(cardId) } as any,
            openHistory: { id: history.id } as any,
            quantity,
          }),
        );
      }
    });

    await this.usersService.updatePostOpeningStats(userId, 50);
    this.eventEmitter.emit('booster.opened', {
      userId,
      boosterId: booster.id,
      setId: booster.cardSet.id,
      amount: 1,
      cardsDrawn: drawnCards,
    });
    return {
      historyId: historyId!,
      booster: booster.name,
      cards: drawnCards,
    };
  }
}
