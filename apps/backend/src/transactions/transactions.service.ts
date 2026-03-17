import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { ProductType } from './enums/product-type.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}
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
  // ============================================================
  // 🟡 CRÉER UNE ANNONCE
  // ============================================================
  async createListing(dto: CreateListingDto, sellerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const seller = await manager.findOne(User, { where: { id: sellerId } });
      if (!seller) throw new BadRequestException('Seller not found');

      await this.reserveItem(manager, dto, sellerId);

      const totalPrice = dto.unitPrice * dto.quantity;
      const listing = manager.getRepository(Transaction).create({
        seller: { id: sellerId } as any,
        productType: dto.productType,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice,
        status: TransactionStatus.PENDING,
      });

      return manager.getRepository(Transaction).save(listing);
    });
  }

  // ============================================================
  // 🟢 ACHETER UNE ANNONCE
  // ============================================================
  async buyListing(transactionId: number, buyerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!listing) throw new BadRequestException('Listing not found');
      if (listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Already sold or cancelled');

      const buyer = await manager.findOne(User, {
        where: { id: buyerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!buyer) throw new BadRequestException('Buyer not found');
      if (buyer.id === listing.seller.id)
        throw new BadRequestException("Can't buy your own listing");
      if (buyer.gold < listing.totalPrice)
        throw new BadRequestException('Not enough gold');

      const seller = await manager.findOne(User, {
        where: { id: listing.seller.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!seller) throw new BadRequestException('Seller not found');

      // 💰 Transfert d'argent
      buyer.gold -= listing.totalPrice;
      buyer.moneySpent += listing.totalPrice;
      seller.gold += listing.totalPrice;
      seller.moneyEarned += listing.totalPrice;

      // 📦 Transfert de l'item
      await this.transferItem(manager, listing, buyer, seller);

      listing.status = TransactionStatus.COMPLETED;
      listing.buyer = buyer;
      listing.seller = seller;

      await manager.save(buyer);
      await manager.save(seller);
      await manager.save(listing);

      return listing;
    });
  }

  // ============================================================
  // 🔴 ANNULER UNE ANNONCE (vendeur)
  // ============================================================
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

      await this.restoreReservedItem(manager, listing, sellerId);
      listing.status = TransactionStatus.CANCELLED;
      return manager.save(listing);
    });
  }

  // ============================================================
  // 📜 HISTORIQUE UTILISATEUR
  // ============================================================
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
  // 🔒 PRIVATE — Réserver l'item lors de la mise en vente
  // ============================================================
  private async reserveItem(
    manager: EntityManager,
    dto: CreateListingDto,
    sellerId: number,
  ) {
    switch (dto.productType) {
      case ProductType.CARD: {
        const item = await manager.findOne(UserCard, {
          where: { id: dto.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException(
            'Card not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough card quantity');
        item.quantity -= dto.quantity;
        await manager.save(item);
        break;
      }
      case ProductType.BOOSTER: {
        const item = await manager.findOne(UserBooster, {
          where: { id: dto.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException(
            'Booster not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough booster quantity');
        item.quantity -= dto.quantity;
        await manager.save(item);
        break;
      }
      case ProductType.BUNDLE: {
        const item = await manager.findOne(UserBundle, {
          where: { id: dto.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException(
            'Bundle not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough bundle quantity');
        item.quantity -= dto.quantity;
        await manager.save(item);
        break;
      }
    }
  }

  // ============================================================
  // 🔒 PRIVATE — Restituer l'item réservé lors d'une annulation
  // ============================================================
  private async restoreReservedItem(
    manager: EntityManager,
    listing: Transaction,
    sellerId: number,
  ) {
    switch (listing.productType) {
      case ProductType.CARD: {
        const item = await manager.findOne(UserCard, {
          where: { id: listing.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException('Seller card item not found');
        item.quantity += listing.quantity;
        await manager.save(item);
        break;
      }
      case ProductType.BOOSTER: {
        const item = await manager.findOne(UserBooster, {
          where: { id: listing.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException('Seller booster item not found');
        item.quantity += listing.quantity;
        await manager.save(item);
        break;
      }
      case ProductType.BUNDLE: {
        const item = await manager.findOne(UserBundle, {
          where: { id: listing.productId, user: { id: sellerId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item)
          throw new BadRequestException('Seller bundle item not found');
        item.quantity += listing.quantity;
        await manager.save(item);
        break;
      }
    }
  }

  // ============================================================
  // 📦 PRIVATE — Transférer l'item lors de l'achat
  // ============================================================
  private async transferItem(
    manager: EntityManager,
    listing: Transaction,
    buyer: User,
    seller: User,
  ) {
    switch (listing.productType) {
      case ProductType.CARD: {
        const sellerItem = await manager.findOne(UserCard, {
          where: { id: listing.productId, user: { id: seller.id } },
          relations: ['card'],
          lock: { mode: 'pessimistic_write' },
        });
        if (!sellerItem)
          throw new BadRequestException('Seller card item not found');

        let buyerItem = await manager.findOne(UserCard, {
          where: { user: { id: buyer.id }, card: { id: sellerItem.card.id } },
          lock: { mode: 'pessimistic_write' },
        });
        if (buyerItem) {
          buyerItem.quantity += listing.quantity;
        } else {
          buyerItem = manager.create(UserCard, {
            user: buyer,
            card: sellerItem.card,
            quantity: listing.quantity,
          });
        }
        await manager.save(buyerItem);
        buyer.cardsBought += listing.quantity;
        seller.cardsSold += listing.quantity;
        break;
      }

      case ProductType.BOOSTER: {
        const sellerItem = await manager.findOne(UserBooster, {
          where: { id: listing.productId, user: { id: seller.id } },
          relations: ['booster'],
          lock: { mode: 'pessimistic_write' },
        });
        if (!sellerItem)
          throw new BadRequestException('Seller booster item not found');

        let buyerItem = await manager.findOne(UserBooster, {
          where: {
            user: { id: buyer.id },
            booster: { id: sellerItem.booster.id },
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (buyerItem) {
          buyerItem.quantity += listing.quantity;
        } else {
          buyerItem = manager.create(UserBooster, {
            user: buyer,
            booster: sellerItem.booster,
            quantity: listing.quantity,
          });
        }
        await manager.save(buyerItem);
        buyer.boostersBought += listing.quantity;
        seller.boostersSold += listing.quantity;
        break;
      }

      case ProductType.BUNDLE: {
        const sellerItem = await manager.findOne(UserBundle, {
          where: { id: listing.productId, user: { id: seller.id } },
          relations: ['bundle'],
          lock: { mode: 'pessimistic_write' },
        });
        if (!sellerItem)
          throw new BadRequestException('Seller bundle item not found');

        let buyerItem = await manager.findOne(UserBundle, {
          where: {
            user: { id: buyer.id },
            bundle: { id: sellerItem.bundle.id },
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (buyerItem) {
          buyerItem.quantity += listing.quantity;
        } else {
          buyerItem = manager.create(UserBundle, {
            user: buyer,
            bundle: sellerItem.bundle,
            quantity: listing.quantity,
          });
        }
        await manager.save(buyerItem);
        buyer.bundlesBought += listing.quantity;
        seller.bundlesSold += listing.quantity;
        break;
      }
    }
  }
}
