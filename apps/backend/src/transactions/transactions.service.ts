import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { ProductType } from './enums/product-type.enum';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCard)
    private userCardRepository: Repository<UserCard>,
    @InjectRepository(UserBooster)
    private userBoosterRepository: Repository<UserBooster>,
    @InjectRepository(UserBundle)
    private userBundleRepository: Repository<UserBundle>,
    private dataSource: DataSource,
  ) {}

  // 🟡 Créer une annonce
  async createListing(dto: CreateListingDto, sellerId: number) {
    const seller = await this.userRepository.findOneBy({ id: sellerId });
    if (!seller) throw new BadRequestException('Seller not found');

    // Vérifier que le vendeur possède bien le produit en quantité suffisante
    switch (dto.productType) {
      case ProductType.CARD: {
        const item = await this.userCardRepository.findOne({
          where: { id: dto.productId, user: { id: sellerId } },
        });
        if (!item)
          throw new BadRequestException(
            'Card not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough card quantity');
        // 🔒 Réserver la quantité pour éviter la double vente
        item.quantity -= dto.quantity;
        await this.userCardRepository.save(item);
        break;
      }
      case ProductType.BOOSTER: {
        const item = await this.userBoosterRepository.findOne({
          where: { id: dto.productId, user: { id: sellerId } },
        });
        if (!item)
          throw new BadRequestException(
            'Booster not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough booster quantity');
        item.quantity -= dto.quantity;
        await this.userBoosterRepository.save(item);
        break;
      }
      case ProductType.BUNDLE: {
        const item = await this.userBundleRepository.findOne({
          where: { id: dto.productId, user: { id: sellerId } },
        });
        if (!item)
          throw new BadRequestException(
            'Bundle not found or not owned by seller',
          );
        if (item.quantity < dto.quantity)
          throw new BadRequestException('Not enough bundle quantity');
        item.quantity -= dto.quantity;
        await this.userBundleRepository.save(item);
        break;
      }
    }

    const totalPrice = dto.unitPrice * dto.quantity;
    const listing = this.transactionRepository.create({
      seller,
      productType: dto.productType,
      productId: dto.productId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalPrice,
      status: TransactionStatus.PENDING,
    });

    return this.transactionRepository.save(listing);
  }

  // 🟢 Acheter une annonce
  async buyListing(transactionId: number, buyerId: number) {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['seller'],
      });
      if (!listing) throw new BadRequestException('Listing not found');
      if (listing.status !== TransactionStatus.PENDING)
        throw new BadRequestException('Already sold or cancelled');

      const buyer = await manager.findOne(User, { where: { id: buyerId } });
      if (!buyer) throw new BadRequestException('Buyer not found');
      if (buyer.id === listing.seller.id)
        throw new BadRequestException("Can't buy your own listing");
      if (buyer.gold < listing.totalPrice)
        throw new BadRequestException('Not enough gold');

      // 💰 Transfert d'argent
      buyer.gold -= listing.totalPrice;
      buyer.moneySpent += listing.totalPrice;
      listing.seller.gold += listing.totalPrice;
      listing.seller.moneyEarned += listing.totalPrice;

      // 📦 Transfert de l'item au buyer
      switch (listing.productType) {
        case ProductType.CARD: {
          const sellerItem = await manager.findOne(UserCard, {
            where: { id: listing.productId },
            relations: ['card'],
          });
          // ✅ Guard null
          if (!sellerItem)
            throw new BadRequestException('Seller card item not found');

          let buyerItem = await manager.findOne(UserCard, {
            where: { user: { id: buyer.id }, card: { id: sellerItem.card.id } },
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
          listing.seller.cardsSold += listing.quantity;
          break;
        }
        case ProductType.BOOSTER: {
          const sellerItem = await manager.findOne(UserBooster, {
            where: { id: listing.productId },
            relations: ['booster'],
          });
          if (!sellerItem)
            throw new BadRequestException('Seller booster item not found');

          let buyerItem = await manager.findOne(UserBooster, {
            where: {
              user: { id: buyer.id },
              booster: { id: sellerItem.booster.id },
            },
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
          listing.seller.boostersSold += listing.quantity;
          break;
        }
        case ProductType.BUNDLE: {
          const sellerItem = await manager.findOne(UserBundle, {
            where: { id: listing.productId },
            relations: ['bundle'],
          });
          if (!sellerItem)
            throw new BadRequestException('Seller bundle item not found');

          let buyerItem = await manager.findOne(UserBundle, {
            where: {
              user: { id: buyer.id },
              bundle: { id: sellerItem.bundle.id },
            },
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
          listing.seller.bundlesSold += listing.quantity;
          break;
        }
      }

      listing.status = TransactionStatus.COMPLETED;
      listing.buyer = buyer;

      await manager.save(buyer);
      await manager.save(listing.seller);
      await manager.save(listing);

      return listing;
    });
  }

  // 📜 Historique utilisateur
  async getUserHistory(userId: number) {
    return this.transactionRepository.find({
      where: [{ buyer: { id: userId } }, { seller: { id: userId } }],
      order: { createdAt: 'DESC' },
      relations: ['buyer', 'seller'],
    });
  }
}
