import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { Card } from '../cards/card.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { ProductType } from './enums/product-type.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

export interface ListingSoldPayload {
  sellerId: number;
  buyerUsername: string;
  itemName: string;
  totalPrice: number;
  transactionId: number;
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  // ============================================================
  // 🔍 LECTURE DES ANNONCES
  // ============================================================

  async findAll(pagination: PaginationDto = {}) {
    const { page = 1, limit = 20 } = pagination;
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

  async findOtherListings(pagination: PaginationDto, userId: number) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const [data, total] = await this.transactionRepository.findAndCount({
      where: { status: TransactionStatus.PENDING, seller: { id: Not(userId) } },
      relations: ['seller'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUserListings(pagination: PaginationDto, userId: number) {
    const { page = 1, limit = 20 } = pagination;
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { status: TransactionStatus.PENDING, seller: { id: userId } },
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

  async getUserHistory(userId: number, pagination: PaginationDto = {}) {
    const { page = 1, limit = 20 } = pagination;
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
  // 🟡 CRÉER / ANNULER
  // ============================================================

  async createListing(dto: CreateListingDto, sellerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const { Entity, relationKey } = this.mapProductType(dto.productType);

      const inventoryItem = await manager.findOne(Entity, {
        where: { [relationKey]: { id: dto.productId }, user: { id: sellerId } },
        relations: [relationKey],
        lock: { mode: 'pessimistic_write' },
      });

      if (!inventoryItem || inventoryItem.quantity < dto.quantity) {
        throw new BadRequestException(
          `Quantité de ${dto.productType} insuffisante.`,
        );
      }

      const itemName =
        (inventoryItem as any)[relationKey]?.name ?? `Objet #${dto.productId}`;

      inventoryItem.quantity -= dto.quantity;
      await manager.save(inventoryItem);

      const listing = manager.getRepository(Transaction).create({
        seller: { id: sellerId } as any,
        productType: dto.productType,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice: dto.unitPrice * dto.quantity,
        status: TransactionStatus.PENDING,
        itemName,
      });

      const saved = await manager.save(listing);

      return manager.findOne(Transaction, {
        where: { id: saved.id },
        relations: ['seller'],
      });
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
  // 🟢 ACHETER
  // ============================================================

  async buyListing(transactionId: number, buyerId: number) {
    const result = await this.dataSource.transaction(async (manager) => {
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

      const totalPriceNum = Number(listing.totalPrice);
      if (Number(buyer.gold) < totalPriceNum)
        throw new BadRequestException('Or insuffisant.');

      buyer.gold = Number(buyer.gold) - totalPriceNum;
      buyer.moneySpent = Number(buyer.moneySpent) + totalPriceNum;
      seller.gold = Number(seller.gold) + totalPriceNum;
      seller.moneyEarned = Number(seller.moneyEarned) + totalPriceNum;

      // ✅ On récupère le setId si c'est une carte (pour COMPLETE_SET)
      const setId = await this.giveItemToBuyer(manager, listing, buyerId);

      await manager.save([buyer, seller]);
      const qty = listing.quantity;
      if (listing.productType === ProductType.CARD) {
        await manager.increment(User, { id: buyerId }, 'cardsBought', qty);
        await manager.increment(
          User,
          { id: listing.seller.id },
          'cardsSold',
          qty,
        );
      } else if (listing.productType === ProductType.BOOSTER) {
        await manager.increment(User, { id: buyerId }, 'boostersBought', qty);
        await manager.increment(
          User,
          { id: listing.seller.id },
          'boostersSold',
          qty,
        );
      } else if (listing.productType === ProductType.BUNDLE) {
        await manager.increment(User, { id: buyerId }, 'bundlesBought', qty);
        await manager.increment(
          User,
          { id: listing.seller.id },
          'bundlesSold',
          qty,
        );
      }
      await manager.update(Transaction, transactionId, {
        status: TransactionStatus.COMPLETED,
        buyer: { id: buyerId } as any,
        updatedAt: new Date(),
      });

      listing.status = TransactionStatus.COMPLETED;
      listing.buyer = buyer;

      // ✅ On retourne aussi le setId
      return { listing, seller, buyer, setId };
    });

    const payload: ListingSoldPayload = {
      sellerId: result.seller.id,
      buyerUsername: result.buyer.username,
      itemName: result.listing.itemName ?? `Objet #${result.listing.productId}`,
      totalPrice: Number(result.listing.totalPrice),
      transactionId,
    };

    this.eventEmitter.emit('listing.sold', payload);

    // ── Quest tracking ──
    const qty = result.listing.quantity;
    const type = result.listing.productType;

    if (type === ProductType.CARD) {
      this.eventEmitter.emit('market.card.bought', {
        userId: buyerId,
        amount: qty,
      });
      this.eventEmitter.emit('market.card.sold', {
        userId: result.seller.id,
        amount: qty,
      });

      // ✅ Vérifie si le set est complété après l'achat de la carte
      if (result.setId) {
        this.eventEmitter.emit('card.set.check', {
          userId: buyerId,
          setId: result.setId,
        });
      }
    } else if (type === ProductType.BOOSTER) {
      this.eventEmitter.emit('market.booster.bought', {
        userId: buyerId,
        amount: qty,
      });
      this.eventEmitter.emit('market.booster.sold', {
        userId: result.seller.id,
        amount: qty,
      });
    } else if (type === ProductType.BUNDLE) {
      this.eventEmitter.emit('market.bundle.bought', {
        userId: buyerId,
        amount: qty,
      });
      this.eventEmitter.emit('market.bundle.sold', {
        userId: result.seller.id,
        amount: qty,
      });
    }

    return result.listing;
  }

  // ============================================================
  // 🔒 LOGIQUE INTERNE
  // ============================================================

  // ✅ Retourne le setId si c'est une carte, null sinon
  private async giveItemToBuyer(
    manager: EntityManager,
    listing: Transaction,
    buyerId: number,
  ): Promise<number | null> {
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
    } else {
      buyerItem = manager.create(Entity, {
        user: { id: buyerId },
        [relationKey]: { id: listing.productId },
        quantity: listing.quantity,
      });
    }
    await manager.save(buyerItem);

    // ✅ On charge le cardSet pour récupérer le setId
    if (listing.productType === ProductType.CARD) {
      const card = await manager.findOne(Card, {
        where: { id: listing.productId },
        relations: ['cardSet'],
      });
      return card?.cardSet?.id ?? null;
    }

    return null;
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
