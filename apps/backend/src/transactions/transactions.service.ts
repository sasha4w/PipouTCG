import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not } from 'typeorm'; // ✅ Import Not corrigé
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
  // 🔍 LECTURE DES ANNONCES
  // ============================================================

  async findAll({ page = 1, limit = 20 }: PaginationDto = {}) {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { status: TransactionStatus.PENDING },
        order: { createdAt: 'DESC' },
        relations: ['seller'],
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOtherListings(
    { page = 1, limit = 20 }: PaginationDto,
    userId: number,
  ) {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: {
          status: TransactionStatus.PENDING,
          seller: { id: Not(userId) }, // ✅ Utilisation de Not[cite: 2]
        },
        order: { createdAt: 'DESC' },
        relations: ['seller'],
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUserListings(
    { page = 1, limit = 20 }: PaginationDto,
    userId: number,
  ) {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: {
          status: TransactionStatus.PENDING,
          seller: { id: userId },
        },
        order: { createdAt: 'DESC' },
        relations: ['seller'],
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

      // 1. Trouver la ligne d'inventaire spécifique du vendeur
      const inventoryItem = await manager.findOne(Entity, {
        where: { id: dto.productId, user: { id: sellerId } },
        relations: [relationKey],
        lock: { mode: 'pessimistic_write' },
      });

      if (!inventoryItem || inventoryItem.quantity < dto.quantity) {
        throw new BadRequestException(
          `Quantité de ${dto.productType} insuffisante.`,
        );
      }

      // 2. Récupérer l'ID statique (ex: card_id) avant de modifier
      const staticId = inventoryItem[relationKey].id;

      // 3. Réserver l'item (Décrémentation, on garde la ligne même à 0)
      inventoryItem.quantity -= dto.quantity;
      await manager.save(inventoryItem);

      // 4. Créer l'annonce (on stocke le staticId pour l'acheteur)
      const listing = manager.getRepository(Transaction).create({
        seller: { id: sellerId } as any,
        productType: dto.productType,
        productId: staticId,
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

      if (!listing) throw new BadRequestException('Listing not found');
      if (listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Already sold or cancelled');
      if (listing.seller.id !== sellerId)
        throw new BadRequestException("Can't cancel someone else's listing");

      // Restituer l'item sur la ligne d'inventaire du vendeur
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

      // 1. Récupération avec vérification immédiate pour TypeScript ✅
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

      // 2. Maintenant, TS sait que buyer et seller existent !
      if (buyer.id === seller.id)
        throw new BadRequestException("Impossible d'acheter sa propre annonce");

      if (buyer.gold < listing.totalPrice)
        throw new BadRequestException('Or insuffisant.');

      // 💰 Transfert de fonds
      buyer.gold -= listing.totalPrice;
      buyer.moneySpent += listing.totalPrice;
      seller.gold += listing.totalPrice;
      seller.moneyEarned += listing.totalPrice;

      // 📦 Transfert de l'objet
      await this.giveItemToBuyer(manager, listing, buyerId);

      // ✅ Finalisation
      listing.status = TransactionStatus.COMPLETED;
      listing.buyer = buyer; // Plus besoin du "as any" ici car buyer est validé

      await manager.save([buyer, seller, listing]);
      return listing;
    });
  }
  async getUserHistory(
    userId: number,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: [{ buyer: { id: userId } }, { seller: { id: userId } }],
        order: { createdAt: 'DESC' },
        relations: ['buyer', 'seller'],
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

    if (!item)
      throw new BadRequestException("Ligne d'inventaire vendeur introuvable");
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
