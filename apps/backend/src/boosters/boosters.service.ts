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
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { User } from '../users/user.entity';
import { Card } from '../cards/card.entity';
import { CardNumber } from './enums/cardnumber.enum';
import { Rarity } from '../cards/enums/rarity.enum';

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
    @InjectRepository(UserCard)
    private userCardRepository: Repository<UserCard>,
    @InjectRepository(UserBooster)
    private userBoosterRepository: Repository<UserBooster>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
  ) {}

  // Retourne tous les boosters avec leur cardSet associé
  findAll() {
    return this.boosterRepository.find({
      relations: { cardSet: true },
    });
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
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const booster = await this.boosterRepository.findOne({
      where: { id: boosterId },
    });
    if (!booster) throw new NotFoundException(`Booster ${boosterId} not found`);

    // Vérification que l'utilisateur a suffisamment de gold
    if (Number(user.gold) < booster.price) {
      throw new BadRequestException(
        `Not enough gold. Required: ${booster.price}, available: ${user.gold}`,
      );
    }

    // Déduction du gold et mise à jour des stats
    user.gold = Number(user.gold) - booster.price;
    user.moneySpent = Number(user.moneySpent) + booster.price;
    user.boostersBought += 1;
    await this.userRepository.save(user);

    // Ajout ou incrémentation du booster dans l'inventaire user_booster
    const existing = await this.userBoosterRepository.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });

    if (existing) {
      existing.quantity += 1;
      await this.userBoosterRepository.save(existing);
    } else {
      await this.userBoosterRepository.save(
        this.userBoosterRepository.create({
          user: { id: userId } as any,
          booster: { id: boosterId } as any,
          quantity: 1,
        }),
      );
    }

    return {
      message: `Booster "${booster.name}" acheté avec succès`,
      goldSpent: booster.price,
      goldRemaining: user.gold,
    };
  }

  // ============================================================
  // OUVERTURE D'UN BOOSTER
  // Vérifie l'inventaire → -1 user_booster → génère N cartes → +N user_card
  // ============================================================
  async openBooster(boosterId: number, userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const booster = await this.boosterRepository.findOne({
      where: { id: boosterId },
      relations: { cardSet: true },
    });
    if (!booster) throw new NotFoundException(`Booster ${boosterId} not found`);

    // Vérification que le user possède au moins 1 exemplaire de ce booster
    const userBooster = await this.userBoosterRepository.findOne({
      where: { user: { id: userId }, booster: { id: boosterId } },
    });
    if (!userBooster || userBooster.quantity < 1) {
      throw new BadRequestException(`You don't own this booster`);
    }

    // Récupération des cartes du cardSet du booster
    const cards = await this.cardRepository.find({
      where: { cardSet: { id: booster.cardSet.id } },
    });
    if (!cards.length) {
      throw new BadRequestException(
        `No cards found in set "${booster.cardSet.name}"`,
      );
    }

    // Groupement des cartes par rareté pour le tirage pondéré
    const cardsByRarity = cards.reduce(
      (acc, card) => {
        if (!acc[card.rarity]) acc[card.rarity] = [];
        acc[card.rarity].push(card);
        return acc;
      },
      {} as Record<Rarity, Card[]>,
    );

    const drawnCards: Card[] = [];

    // Placement des cartes garanties selon le type de booster
    const guarantees = BOOSTER_GUARANTEES[booster.cardNumber] ?? [];
    for (const guaranteedRarity of guarantees) {
      drawnCards.push(this.drawCardOfRarity(guaranteedRarity, cardsByRarity));
    }

    // Complétion des slots restants avec un tirage aléatoire pondéré
    const remainingSlots = booster.cardNumber - drawnCards.length;
    for (let i = 0; i < remainingSlots; i++) {
      drawnCards.push(this.drawCard(cardsByRarity));
    }

    // Mélange du tableau pour que les garanties ne soient pas toujours en premier
    drawnCards.sort(() => Math.random() - 0.5);

    // Retrait de 1 booster dans l'inventaire user_booster
    // Si c'était le dernier, on supprime l'entrée
    if (userBooster.quantity === 1) {
      await this.userBoosterRepository.remove(userBooster);
    } else {
      userBooster.quantity -= 1;
      await this.userBoosterRepository.save(userBooster);
    }

    // Mise à jour des stats d'ouverture
    user.boostersOpened += 1;
    await this.userRepository.save(user);

    // Création de l'historique d'ouverture
    const history = await this.openHistoryRepository.save(
      this.openHistoryRepository.create({
        user: { id: user.id } as any,
        booster: { id: booster.id } as any,
        openedAt: new Date(),
      }),
    );

    // Enregistrement des cartes tirées dans booster_open_card
    await this.openCardRepository.save(
      drawnCards.map((card) =>
        this.openCardRepository.create({
          card: { id: card.id } as any,
          openHistory: { id: history.id } as any,
        }),
      ),
    );

    // Ajout des cartes dans l'inventaire user_card
    // Si la carte est déjà possédée → incrémente la quantité
    // Sinon → crée une nouvelle entrée avec quantité = 1
    for (const card of drawnCards) {
      const existing = await this.userCardRepository.findOne({
        where: { user: { id: user.id }, card: { id: card.id } },
      });

      if (existing) {
        existing.quantity += 1;
        await this.userCardRepository.save(existing);
      } else {
        await this.userCardRepository.save(
          this.userCardRepository.create({
            user: { id: user.id } as any,
            card: { id: card.id } as any,
            quantity: 1,
          }),
        );
      }
    }

    return {
      historyId: history.id,
      booster: booster.name,
      cards: drawnCards,
    };
  }
}
