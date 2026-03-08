import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booster } from './booster.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { BoosterOpenCard } from './booster-open-card.entity';
import { Card } from '../cards/card.entity';
import { CardNumber } from './enums/cardnumber.enum';
import { Rarity } from '../cards/enums/rarity.enum';
import { UsersService } from '../users/users.service';
import { PaginationDto } from '../common/dto/pagination.dto';

// ============================================================
// CONFIGURATION DES TAUX DE RARETÉ
// Total = 100%, ajustable selon l'équilibrage souhaité
// ============================================================
const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 60, // 60%
  [Rarity.UNCOMMON]: 25, // 25%
  [Rarity.RARE]: 10, // 10%
  [Rarity.EPIC]: 4, //  4%
  [Rarity.LEGENDARY]: 0.8, //  0.8%
  [Rarity.SECRET]: 0.2, //  0.2%
};

// ============================================================
// GARANTIES PAR TYPE DE BOOSTER
// Booster 8  → 1 rare garantie
// Booster 10 → 1 rare + 1 epic garanties
// ============================================================
const BOOSTER_GUARANTEES: Partial<Record<CardNumber, Rarity[]>> = {
  [CardNumber.EIGHT]: [Rarity.RARE],
  [CardNumber.TEN]: [Rarity.RARE, Rarity.EPIC],
};

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
  ) {}

  // Retourne tous les boosters avec leur cardSet associé
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

  // Retourne un booster par son ID avec son cardSet et ses historiques d'ouverture
  async findOne(id: number) {
    const booster = await this.boosterRepository.findOne({
      where: { id },
      relations: { cardSet: true, openHistories: true },
    });
    if (!booster)
      throw new NotFoundException(`Booster with ID ${id} not found`);
    return booster;
  }

  // Crée un nouveau booster et l'associe à un cardSet
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

  // Met à jour les informations d'un booster existant
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
    if (data.cardSetId) {
      booster.cardSet = { id: data.cardSetId } as any;
    }
    Object.assign(booster, data);
    return this.boosterRepository.save(booster);
  }

  // Supprime un booster par son ID
  async remove(id: number) {
    const booster = await this.findOne(id);
    await this.boosterRepository.remove(booster);
    return { message: `Booster with ID ${id} deleted` };
  }

  // ============================================================
  // MÉTHODES PRIVÉES DE TIRAGE
  // ============================================================

  // Tire une rareté aléatoire en fonction des poids définis dans RARITY_WEIGHTS
  private drawRarity(): Rarity {
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce(
      (sum, w) => sum + w,
      0,
    );
    let roll = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
      roll -= weight;
      if (roll <= 0) return rarity as Rarity;
    }

    return Rarity.COMMON; // Fallback de sécurité
  }

  // Tire une carte d'une rareté précise
  // Si le pool est vide, descend vers la rareté inférieure suivante
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
      if (pool?.length) {
        return pool[Math.floor(Math.random() * pool.length)];
      }
    }

    throw new BadRequestException('No card available in any rarity pool');
  }

  // Tire une carte aléatoirement selon les taux de rareté
  private drawCard(cardsByRarity: Record<Rarity, Card[]>): Card {
    const rarity = this.drawRarity();
    return this.drawCardOfRarity(rarity, cardsByRarity);
  }

  // ============================================================
  // ACHAT D'UN BOOSTER
  // Débite le gold et ajoute le booster dans user_booster
  // ============================================================
  async buyBooster(boosterId: number, userId: number) {
    // 1. On récupère le user via le UsersService
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const booster = await this.findOne(boosterId);

    // 2. Vérification de l'or
    if (Number(user.gold) < booster.price) {
      throw new BadRequestException(
        `Not enough gold. Required: ${booster.price}, available: ${user.gold}`,
      );
    }

    // 3. Paiement et Stats (Il faudra ajouter cette petite méthode dans UsersService)
    await this.usersService.spendGoldAndRecordPurchase(userId, booster.price);

    // 4. Ajout dans l'inventaire via le service délégué !
    await this.usersService.addBoosterToUser(userId, boosterId, 1);

    return {
      message: `Booster "${booster.name}" acheté avec succès`,
      goldSpent: booster.price,
      goldRemaining: Number(user.gold) - booster.price,
    };
  }

  // ============================================================
  // OUVERTURE D'UN BOOSTER
  // Vérifie l'inventaire → -1 user_booster → génère N cartes → +N user_card
  // ============================================================
  async openBooster(boosterId: number, userId: number) {
    // 1. Récupération des données de base
    const booster = await this.findOne(boosterId); // Utilise ton findOne qui check déjà le NotFound

    // 2. Vérification et retrait du booster (Délégué à UsersService)
    // Cette méthode dans UsersService fait déjà le check de quantité et le remove/save
    await this.usersService.removeBoosterFromUser(userId, boosterId);

    // 3. Récupération des cartes du set
    const cards = await this.cardRepository.find({
      where: { cardSet: { id: booster.cardSet.id } },
    });
    if (!cards.length)
      throw new BadRequestException(`No cards in set ${booster.cardSet.name}`);

    // 4. LOGIQUE DE TIRAGE (Ton algorithme reste ici)
    const cardsByRarity = cards.reduce(
      (acc, card) => {
        if (!acc[card.rarity]) acc[card.rarity] = [];
        acc[card.rarity].push(card);
        return acc;
      },
      {} as Record<Rarity, Card[]>,
    );

    const drawnCards: Card[] = [];
    const guarantees = BOOSTER_GUARANTEES[booster.cardNumber] ?? [];
    for (const rarity of guarantees) {
      drawnCards.push(this.drawCardOfRarity(rarity, cardsByRarity));
    }
    const remainingSlots = booster.cardNumber - drawnCards.length;
    for (let i = 0; i < remainingSlots; i++) {
      drawnCards.push(this.drawCard(cardsByRarity));
    }
    drawnCards.sort(() => Math.random() - 0.5);

    // 5. ENREGISTREMENT (Délégué aux services respectifs)

    // Création de l'historique
    const history = await this.openHistoryRepository.save(
      this.openHistoryRepository.create({
        user: { id: userId } as any,
        booster: { id: booster.id } as any,
        openedAt: new Date(),
      }),
    );

    // Cartes de l'historique + Ajout dans l'inventaire User
    for (const card of drawnCards) {
      await this.usersService.addCardToUser(userId, card.id);

      // Lien historique
      await this.openCardRepository.save(
        this.openCardRepository.create({
          card: { id: card.id } as any,
          openHistory: { id: history.id } as any,
        }),
      );
    }

    // Mise à jour des stats globales (XP + compteurs)
    await this.usersService.updatePostOpeningStats(userId, 50);

    return {
      historyId: history.id,
      booster: booster.name,
      cards: drawnCards,
    };
  }
}
