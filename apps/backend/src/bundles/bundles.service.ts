import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bundle } from './bundle.entity';
import { BundleContent } from './bundle-content.entity';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';
import { AddBundleContentDto } from './dto/add-bundle-content.dto';
import { UserBundle } from '../users/user-bundle.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { User } from '../users/user.entity';
@Injectable()
export class BundlesService {
  constructor(
    @InjectRepository(Bundle)
    private bundleRepository: Repository<Bundle>,
    @InjectRepository(BundleContent)
    private bundleContentRepository: Repository<BundleContent>,
    @InjectRepository(UserBundle)
    private userBundleRepository: Repository<UserBundle>,
    @InjectRepository(UserCard)
    private userCardRepository: Repository<UserCard>,
    @InjectRepository(UserBooster)
    private userBoosterRepository: Repository<UserBooster>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  findAll() {
    return this.bundleRepository.find({
      relations: {
        contents: {
          card: true,
          booster: true,
        },
      },
    });
  }

  async findOne(id: number) {
    const bundle = await this.bundleRepository.findOne({
      where: { id },
      relations: {
        contents: {
          card: true,
          booster: true,
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${id} not found`);
    }

    return bundle;
  }

  create(dto: CreateBundleDto) {
    const bundle = this.bundleRepository.create(dto);
    return this.bundleRepository.save(bundle);
  }

  async update(id: number, dto: UpdateBundleDto) {
    const bundle = await this.findOne(id);
    Object.assign(bundle, dto);
    return this.bundleRepository.save(bundle);
  }

  async remove(id: number) {
    const bundle = await this.findOne(id);
    await this.bundleRepository.remove(bundle);
    return { message: `Bundle ${id} deleted` };
  }

  async addContent(bundleId: number, dto: AddBundleContentDto) {
    if (!!dto.cardId === !!dto.boosterId) {
      throw new BadRequestException(
        'You must provide either cardId or boosterId (not both)',
      );
    }

    const bundle = await this.findOne(bundleId);

    const content = this.bundleContentRepository.create({
      bundle,
      card: dto.cardId ? ({ id: dto.cardId } as any) : null,
      booster: dto.boosterId ? ({ id: dto.boosterId } as any) : null,
    });

    return this.bundleContentRepository.save(content);
  }
  async buyBundle(bundleId: number, userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const bundle = await this.bundleRepository.findOne({
      where: { id: bundleId },
    });
    if (!bundle) throw new NotFoundException(`Bundle ${bundleId} not found`);

    // Vérification que l'utilisateur a suffisamment de gold
    if (Number(user.gold) < bundle.price) {
      throw new BadRequestException(
        `Not enough gold. Required: ${bundle.price}, available: ${user.gold}`,
      );
    }

    // Déduction du gold et mise à jour des stats
    user.gold = Number(user.gold) - bundle.price;
    user.moneySpent = Number(user.moneySpent) + bundle.price;
    await this.userRepository.save(user);

    // Ajout ou incrémentation dans user_bundle
    const existing = await this.userBundleRepository.findOne({
      where: { user: { id: userId }, bundle: { id: bundleId } },
    });

    if (existing) {
      existing.quantity += 1;
      await this.userBundleRepository.save(existing);
    } else {
      await this.userBundleRepository.save(
        this.userBundleRepository.create({
          user: { id: userId } as any,
          bundle: { id: bundleId } as any,
          quantity: 1,
        }),
      );
    }

    return {
      message: `Bundle "${bundle.name}" acheté avec succès`,
      goldSpent: bundle.price,
      goldRemaining: user.gold,
    };
  }
  // ============================================================
  // OUVERTURE D'UN BUNDLE
  // Vérifie l'inventaire → -1 user_bundle → distribue les contenus
  // cartes → user_card | boosters → user_booster (selon quantity)
  // ============================================================
  async openBundle(bundleId: number, userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const bundle = await this.bundleRepository.findOne({
      where: { id: bundleId },
      relations: {
        contents: {
          card: true,
          booster: true,
        },
      },
    });
    if (!bundle) throw new NotFoundException(`Bundle ${bundleId} not found`);

    // Vérification que le user possède au moins 1 exemplaire de ce bundle
    const userBundle = await this.userBundleRepository.findOne({
      where: { user: { id: userId }, bundle: { id: bundleId } },
    });
    if (!userBundle || userBundle.quantity < 1) {
      throw new BadRequestException(`You don't own this bundle`);
    }

    // Retrait de 1 bundle dans l'inventaire user_bundle
    if (userBundle.quantity === 1) {
      await this.userBundleRepository.remove(userBundle);
    } else {
      userBundle.quantity -= 1;
      await this.userBundleRepository.save(userBundle);
    }

    const distributedCards: { name: string; quantity: number }[] = [];
    const distributedBoosters: { name: string; quantity: number }[] = [];

    // Traitement de chaque ligne de contenu du bundle
    for (const content of bundle.contents) {
      if (content.card) {
        // Ajout ou incrémentation dans user_card (en respectant la quantity du content)
        const existing = await this.userCardRepository.findOne({
          where: { user: { id: userId }, card: { id: content.card.id } },
        });

        if (existing) {
          existing.quantity += content.quantity;
          await this.userCardRepository.save(existing);
        } else {
          await this.userCardRepository.save(
            this.userCardRepository.create({
              user: { id: userId } as any,
              card: { id: content.card.id } as any,
              quantity: content.quantity,
            }),
          );
        }

        distributedCards.push({
          name: content.card.name,
          quantity: content.quantity,
        });
      }

      if (content.booster) {
        // Ajout ou incrémentation dans user_booster (en respectant la quantity du content)
        const existing = await this.userBoosterRepository.findOne({
          where: { user: { id: userId }, booster: { id: content.booster.id } },
        });

        if (existing) {
          existing.quantity += content.quantity;
          await this.userBoosterRepository.save(existing);
        } else {
          await this.userBoosterRepository.save(
            this.userBoosterRepository.create({
              user: { id: userId } as any,
              booster: { id: content.booster.id } as any,
              quantity: content.quantity,
            }),
          );
        }

        distributedBoosters.push({
          name: content.booster.name,
          quantity: content.quantity,
        });
      }
    }

    return {
      message: `Bundle "${bundle.name}" ouvert avec succès`,
      cards: distributedCards,
      boosters: distributedBoosters,
    };
  }
}
