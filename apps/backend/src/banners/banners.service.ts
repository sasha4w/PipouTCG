import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Banner } from './banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UsersService } from '../users/users.service';
import { BoostersService } from '../boosters/boosters.service';
import { BundlesService } from '../bundles/bundles.service';

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
    private usersService: UsersService,
    private boostersService: BoostersService,
    private bundlesService: BundlesService,
  ) {}

  /* ── Helpers ── */

  /** Vérifie que l'item référencé existe réellement en base */
  private async assertItemExists(
    itemType: 'BOOSTER' | 'BUNDLE',
    itemId: number,
  ): Promise<void> {
    try {
      if (itemType === 'BOOSTER') {
        await this.boostersService.findOne(itemId);
      } else {
        await this.bundlesService.findOne(itemId);
      }
    } catch {
      throw new BadRequestException(
        `${itemType} avec l'id ${itemId} introuvable. Vérifiez l'itemId avant de créer la bannière.`,
      );
    }
  }

  /** Vérifie que bannerPrice <= originalPrice */
  private assertPriceCoherence(
    bannerPrice: number,
    originalPrice: number,
  ): void {
    if (bannerPrice > originalPrice) {
      throw new BadRequestException(
        `Le prix bannière (${bannerPrice}) ne peut pas être supérieur au prix original (${originalPrice}).`,
      );
    }
  }

  /* ── USER ── */

  /** Retourne les bannières actives dont la date est valide (event + permanentes) */
  async findActive(): Promise<Banner[]> {
    const now = new Date();

    return this.bannerRepository.find({
      where: [
        // Bannières event avec plage de dates valide
        {
          isActive: true,
          isPermanent: false,
          startDate: LessThanOrEqual(now),
          endDate: MoreThanOrEqual(now),
        },
        // Bannières permanentes (pas de endDate)
        {
          isActive: true,
          isPermanent: true,
          startDate: LessThanOrEqual(now),
        },
      ],
      // Events en premier (les plus proches d'expirer), puis permanentes
      order: { isPermanent: 'ASC', endDate: 'ASC' },
    });
  }

  /** Achète un item via bannière (prix promo) */
  async buyBanner(bannerId: number, userId: number, quantity = 1) {
    const banner = await this.findOne(bannerId);
    const now = new Date();

    const isExpired =
      !banner.isPermanent &&
      (!banner.isActive ||
        banner.startDate > now ||
        (banner.endDate !== null && banner.endDate < now));

    if (!banner.isActive || banner.startDate > now || isExpired) {
      throw new BadRequestException("Cette bannière n'est plus disponible.");
    }

    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} introuvable`);

    const totalCost = banner.bannerPrice * quantity;
    if (Number(user.gold) < totalCost) {
      throw new BadRequestException('Pas assez de gold.');
    }

    await this.usersService.spendGoldAndRecordPurchase(userId, totalCost);

    if (banner.itemType === 'BOOSTER') {
      await this.usersService.addBoosterToUser(userId, banner.itemId, quantity);
    } else {
      await this.usersService.addBundleToUser(userId, banner.itemId, quantity);
    }

    return {
      message: `"${banner.itemName}" ×${quantity} acheté via bannière`,
      goldSpent: totalCost,
      goldRemaining: Number(user.gold) - totalCost,
    };
  }
  /* ── ADMIN ── */

  async findAll(): Promise<Banner[]> {
    return this.bannerRepository.find({ order: { id: 'DESC' } });
  }

  async findOne(id: number): Promise<Banner> {
    const banner = await this.bannerRepository.findOneBy({ id });
    if (!banner) throw new NotFoundException(`Banner ${id} introuvable`);
    return banner;
  }

  async create(dto: CreateBannerDto): Promise<Banner> {
    // Point 2 — cohérence des prix
    this.assertPriceCoherence(dto.bannerPrice, dto.originalPrice);

    // Point 3 — existence de l'item
    await this.assertItemExists(dto.itemType, dto.itemId);

    const banner = this.bannerRepository.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.isPermanent ? null : new Date(dto.endDate!),
      isPermanent: dto.isPermanent ?? false,
    });
    return this.bannerRepository.save(banner);
  }

  async update(id: number, dto: Partial<CreateBannerDto>): Promise<Banner> {
    const banner = await this.findOne(id);

    // Point 2 — cohérence des prix sur update
    const newBannerPrice = dto.bannerPrice ?? banner.bannerPrice;
    const newOriginalPrice = dto.originalPrice ?? banner.originalPrice;
    this.assertPriceCoherence(newBannerPrice, newOriginalPrice);

    // Point 3 — vérification item si l'itemId ou l'itemType change
    if (dto.itemId !== undefined || dto.itemType !== undefined) {
      const itemType = dto.itemType ?? banner.itemType;
      const itemId = dto.itemId ?? banner.itemId;
      await this.assertItemExists(itemType, itemId);
    }

    Object.assign(banner, {
      ...dto,
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.isPermanent === true
        ? { endDate: null }
        : dto.endDate
          ? { endDate: new Date(dto.endDate) }
          : {}),
    });
    return this.bannerRepository.save(banner);
  }

  async remove(id: number): Promise<{ message: string }> {
    const banner = await this.findOne(id);
    await this.bannerRepository.remove(banner);
    return { message: `Banner ${id} supprimée` };
  }

  async toggleActive(id: number): Promise<Banner> {
    const banner = await this.findOne(id);
    banner.isActive = !banner.isActive;
    return this.bannerRepository.save(banner);
  }
}
