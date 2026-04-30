import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
import { UpdateListingDto } from './dto/update-listing.dto';
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

  async getUserHistory(
    userId: number,
    pagination: PaginationDto = {},
    role?: 'seller' | 'buyer',
  ) {
    const { page = 1, limit = 20 } = pagination;

    const where =
      role === 'seller'
        ? { seller: { id: userId }, status: TransactionStatus.COMPLETED }
        : role === 'buyer'
          ? { buyer: { id: userId }, status: TransactionStatus.COMPLETED }
          : [
              { seller: { id: userId }, status: TransactionStatus.COMPLETED },
              { buyer: { id: userId }, status: TransactionStatus.COMPLETED },
            ];

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where,
        order: { updatedAt: 'DESC' },
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
  async getRecentSales(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.transactionRepository.findAndCount({
      where: { status: TransactionStatus.COMPLETED },
      relations: ['seller', 'buyer'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
  // ============================================================
  // 🟣 COMPLETED — admin & detail
  // ============================================================

  async findCompleted(pagination: PaginationDto = {}) {
    const { page = 1, limit = 20 } = pagination;
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { status: TransactionStatus.COMPLETED },
        order: { updatedAt: 'DESC' },
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

  async findCompletedById(transactionId: number) {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, status: TransactionStatus.COMPLETED },
      relations: ['buyer', 'seller'],
    });
    if (!transaction) {
      throw new NotFoundException(
        `Transaction #${transactionId} introuvable ou non complétée.`,
      );
    }
    return transaction;
  }

  // ============================================================
  // 🟡 CRÉER / ANNULER / MODIFIER
  // ============================================================

  async createListing(dto: CreateListingDto, sellerId: number) {
    const saved = await this.dataSource.transaction(async (manager) => {
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

      const created = await manager.save(listing);
      return manager.findOne(Transaction, {
        where: { id: created.id },
        relations: ['seller'],
      });
    });

    if (!saved) {
      throw new BadRequestException(
        "Erreur critique : impossible de récupérer l'annonce après sa création.",
      );
    }

    this.eventEmitter.emit('listing.created', {
      id: saved.id,
      productType: saved.productType,
      itemName: saved.itemName,
      unitPrice: saved.unitPrice,
      quantity: saved.quantity,
      seller: { username: saved.seller.username },
    });

    return saved;
  }

  async updateListing(
    transactionId: number,
    dto: UpdateListingDto,
    sellerId: number,
  ) {
    if (dto.unitPrice === undefined && dto.quantity === undefined) {
      throw new BadRequestException(
        'Au moins unitPrice ou quantity doit être fourni.',
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing) throw new NotFoundException('Annonce introuvable.');
      if (listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException(
          'Impossible de modifier une annonce non active.',
        );
      if (listing.seller.id !== sellerId)
        throw new BadRequestException('Action non autorisée.');

      // ── Gestion du changement de quantité ──
      if (dto.quantity !== undefined && dto.quantity !== listing.quantity) {
        const diff = dto.quantity - listing.quantity; // positif = on veut plus, négatif = on réduit
        const { Entity, relationKey } = this.mapProductType(
          listing.productType,
        );

        const inventoryItem = await manager.findOne(Entity, {
          where: {
            user: { id: sellerId },
            [relationKey]: { id: listing.productId },
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!inventoryItem)
          throw new BadRequestException('Inventaire introuvable.');

        if (diff > 0) {
          // On augmente la quantité en vente → on vérifie le stock dispo
          if (inventoryItem.quantity < diff) {
            throw new BadRequestException(
              `Stock insuffisant. Disponible : ${inventoryItem.quantity}.`,
            );
          }
          inventoryItem.quantity -= diff;
        } else {
          // On réduit la quantité en vente → on restitue la différence
          inventoryItem.quantity += Math.abs(diff);
        }

        await manager.save(inventoryItem);
        listing.quantity = dto.quantity;
      }

      if (dto.unitPrice !== undefined) {
        listing.unitPrice = dto.unitPrice;
      }

      listing.totalPrice = Number(listing.unitPrice) * listing.quantity;

      const updated = await manager.save(listing);
      return manager.findOne(Transaction, {
        where: { id: updated.id },
        relations: ['seller'],
      });
    });

    if (!saved) {
      throw new BadRequestException(
        "Erreur critique : impossible de récupérer l'annonce après la mise à jour.",
      );
    }

    this.eventEmitter.emit('listing.updated', {
      transactionId: saved.id,
      newQuantity: saved.quantity,
      newUnitPrice: saved.unitPrice,
      newTotalPrice: saved.totalPrice,
    });

    return saved;
  }

  async cancelListing(transactionId: number, sellerId: number) {
    const saved = await this.dataSource.transaction(async (manager) => {
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

    this.eventEmitter.emit('listing.cancelled', {
      transactionId: saved.id,
    });

    return saved;
  }

  // ============================================================
  // 🟢 ACHETER — supporte l'achat partiel
  // ============================================================

  async buyListing(
    transactionId: number,
    buyerId: number,
    requestedQty?: number,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing || listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Annonce indisponible.');

      const qty = requestedQty ?? listing.quantity;
      if (qty < 1 || qty > listing.quantity) {
        throw new BadRequestException(
          `Quantité invalide. Disponible : ${listing.quantity}.`,
        );
      }

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

      const totalPrice = Number(listing.unitPrice) * qty;

      if (Number(buyer.gold) < totalPrice)
        throw new BadRequestException('Or insuffisant.');

      buyer.gold = Number(buyer.gold) - totalPrice;
      buyer.moneySpent = Number(buyer.moneySpent) + totalPrice;
      seller.gold = Number(seller.gold) + totalPrice;
      seller.moneyEarned = Number(seller.moneyEarned) + totalPrice;

      const setId = await this.giveItemToBuyer(manager, listing, buyerId, qty);

      await manager.save([buyer, seller]);

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

      const isFullBuy = qty === listing.quantity;

      if (isFullBuy) {
        await manager.update(Transaction, transactionId, {
          status: TransactionStatus.COMPLETED,
          buyer: { id: buyerId } as any,
          totalPrice,
          updatedAt: new Date(),
        });
        listing.status = TransactionStatus.COMPLETED;
      } else {
        await manager.update(Transaction, transactionId, {
          quantity: listing.quantity - qty,
          totalPrice: Number(listing.unitPrice) * (listing.quantity - qty),
          updatedAt: new Date(),
        });
        listing.quantity -= qty;
      }

      listing.buyer = buyer;

      return { listing, seller, buyer, setId, qty, totalPrice, isFullBuy };
    });

    this.eventEmitter.emit('listing.sold', {
      sellerId: result.seller.id,
      buyerUsername: result.buyer.username,
      itemName: result.listing.itemName ?? `Objet #${result.listing.productId}`,
      totalPrice: result.totalPrice,
      transactionId,
    });

    if (!result.isFullBuy) {
      this.eventEmitter.emit('listing.updated', {
        transactionId,
        newQuantity: result.listing.quantity,
      });
    }

    const qty = result.qty;
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

    return {
      ...result.listing,
      purchasedQty: qty,
      totalPrice: result.totalPrice,
    };
  }

  // ============================================================
  // 🔒 LOGIQUE INTERNE
  // ============================================================

  private async giveItemToBuyer(
    manager: EntityManager,
    listing: Transaction,
    buyerId: number,
    qty: number,
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
      buyerItem.quantity += qty;
    } else {
      buyerItem = manager.create(Entity, {
        user: { id: buyerId },
        [relationKey]: { id: listing.productId },
        quantity: qty,
      });
    }
    await manager.save(buyerItem);

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
