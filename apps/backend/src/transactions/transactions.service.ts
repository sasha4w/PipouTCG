import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { ProductType } from './enums/product-type.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private dataSource: DataSource,
  ) {}

  // ============================================================
  // 🔍 LECTURE DES ANNONCES (AVEC RELATIONS POUR LE FRONTEND)
  // ============================================================

  async findAll(pagination: PaginationDto = {}) {
    const { page = 1, limit = 20 } = pagination; // ✅ Fix TS "possibly undefined"

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { status: TransactionStatus.PENDING },
        order: { createdAt: 'DESC' },
        relations: ['seller', 'card', 'booster', 'bundle'], // ✅ Ajout des relations
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOtherListings(pagination: PaginationDto, userId: number) {
    const { page = 1, limit = 20 } = pagination; // ✅ Fix TS "possibly undefined"
    const skip = (page - 1) * limit;

    const [data, total] = await this.transactionRepository.findAndCount({
      where: {
        status: TransactionStatus.PENDING,
        seller: { id: Not(userId) },
      },
      relations: ['seller', 'card', 'booster', 'bundle'], // ✅ Ajout des relations
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUserListings(pagination: PaginationDto, userId: number) {
    const { page = 1, limit = 20 } = pagination; // ✅ Fix TS "possibly undefined"

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: {
          status: TransactionStatus.PENDING,
          seller: { id: userId },
        },
        order: { createdAt: 'DESC' },
        relations: ['seller', 'card', 'booster', 'bundle'], // ✅ Ajout des relations
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserHistory(userId: number, pagination: PaginationDto = {}) {
    const { page = 1, limit = 20 } = pagination; // ✅ Fix TS "possibly undefined"

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: [{ buyer: { id: userId } }, { seller: { id: userId } }],
        order: { createdAt: 'DESC' },
        relations: ['buyer', 'seller', 'card', 'booster', 'bundle'], // ✅ Historique complet
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // 🟡 ACTIONS : CRÉER / ANNULER
  // ============================================================

  async createListing(dto: CreateListingDto, sellerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const { Entity, relationKey } = this.mapProductType(dto.productType);

      const inventoryItem = await manager.findOne(Entity, {
        where: {
          [relationKey]: { id: dto.productId },
          user: { id: sellerId },
        },
        relations: [relationKey],
        lock: { mode: 'pessimistic_write' },
      });

      if (!inventoryItem || inventoryItem.quantity < dto.quantity) {
        throw new BadRequestException(
          `Quantité de ${dto.productType} insuffisante.`,
        );
      }

      // On décrémente le stock de l'inventaire
      inventoryItem.quantity -= dto.quantity;
      await manager.save(inventoryItem);

      // Création de l'annonce en liant l'objet statique pour les relations futures
      const listing = manager.getRepository(Transaction).create({
        seller: { id: sellerId } as any,
        productType: dto.productType,
        productId: dto.productId,
        // On lie dynamiquement la relation pour que le .find() fonctionne après
        [relationKey]: { id: dto.productId },
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice: dto.unitPrice * dto.quantity,
        status: TransactionStatus.PENDING,
      });

      return manager.save(listing);
    });
  }

  async cancelListing(transactionId: number, sellerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing) throw new BadRequestException('Annonce introuvable');
      if (listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Déjà vendue ou annulée');
      if (listing.seller.id !== sellerId)
        throw new BadRequestException('Action non autorisée');

      await this.restoreReservedItem(manager, listing, sellerId);

      listing.status = TransactionStatus.CANCELLED;
      return manager.save(listing);
    });
  }

  // ============================================================
  // 🟢 ACTION : ACHETER
  // ============================================================

  async buyListing(transactionId: number, buyerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing || listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Annonce indisponible.');

      const buyer = await manager.findOne(User, {
        where: { id: buyerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!buyer) throw new BadRequestException('Acheteur introuvable.');

      const seller = await manager.findOne(User, {
        where: { id: listing.seller.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!seller) throw new BadRequestException('Vendeur introuvable.');

      if (buyer.id === seller.id)
        throw new BadRequestException('Achat de sa propre annonce interdit');

      if (buyer.gold < listing.totalPrice)
        throw new BadRequestException('Or insuffisant.');

      // 💰 Transfert d'argent
      buyer.gold -= listing.totalPrice;
      buyer.moneySpent += listing.totalPrice;
      seller.gold += listing.totalPrice;
      seller.moneyEarned += listing.totalPrice;

      // 📦 Transfert de l'objet
      await this.giveItemToBuyer(manager, listing, buyerId);

      listing.status = TransactionStatus.COMPLETED;
      listing.buyer = buyer;

      await manager.save([buyer, seller, listing]);
      return listing;
    });
  }

  // ============================================================
  // 🔒 LOGIQUE INTERNE (PRIVATE)
  // ============================================================

  private async giveItemToBuyer(
    manager: EntityManager,
    listing: Transaction,
    buyerId: number,
  ) {
    const { Entity, relationKey } = this.mapProductType(listing.productType);

    let buyerItem = await manager.findOne(Entity, {
      where: {
        user: { id: buyerId },
        [relationKey]: { id: listing.productId },
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (buyerItem) {
      buyerItem.quantity += listing.quantity;
      await manager.save(buyerItem);
    } else {
      buyerItem = manager.create(Entity, {
        user: { id: buyerId },
        [relationKey]: { id: listing.productId },
        quantity: listing.quantity,
      });
      await manager.save(buyerItem);
    }
  }

  private async restoreReservedItem(
    manager: EntityManager,
    listing: Transaction,
    sellerId: number,
  ) {
    const { Entity, relationKey } = this.mapProductType(listing.productType);

    const item = await manager.findOne(Entity, {
      where: {
        user: { id: sellerId },
        [relationKey]: { id: listing.productId },
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!item) throw new BadRequestException('Inventaire introuvable');
    item.quantity += listing.quantity;
    await manager.save(item);
  }

  private mapProductType(type: ProductType) {
    switch (type) {
      case ProductType.CARD:
        return { Entity: UserCard, relationKey: 'card' };
      case ProductType.BOOSTER:
        return { Entity: UserBooster, relationKey: 'booster' };
      case ProductType.BUNDLE:
        return { Entity: UserBundle, relationKey: 'bundle' };
      default:
        throw new BadRequestException('Type de produit inconnu');
    }
  }
}
