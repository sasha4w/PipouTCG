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

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
    private usersService: UsersService,
  ) {}

  /* ── USER ── */

  /** Retourne les bannières actives dont la date est valide */
  async findActive(): Promise<Banner[]> {
    const now = new Date();
    return this.bannerRepository.find({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
      },
      order: { endDate: 'ASC' }, // les plus proches d'expirer en premier
    });
  }

  /** Achète un item via bannière (prix promo) */
  async buyBanner(bannerId: number, userId: number) {
    const banner = await this.findOne(bannerId);
    const now = new Date();

    if (!banner.isActive || banner.startDate > now || banner.endDate < now) {
      throw new BadRequestException("Cette bannière n'est plus disponible.");
    }

    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} introuvable`);

    if (Number(user.gold) < banner.bannerPrice) {
      throw new BadRequestException('Pas assez de gold.');
    }

    await this.usersService.spendGoldAndRecordPurchase(
      userId,
      banner.bannerPrice,
    );
    if (banner.itemType === 'BOOSTER') {
      await this.usersService.addBoosterToUser(userId, banner.itemId, 1);
    } else {
      await this.usersService.addBundleToUser(userId, banner.itemId, 1);
    }

    return {
      message: `"${banner.itemName}" acheté via bannière`,
      goldSpent: banner.bannerPrice,
      goldRemaining: Number(user.gold) - banner.bannerPrice,
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
    const banner = this.bannerRepository.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
    return this.bannerRepository.save(banner);
  }

  async update(id: number, dto: Partial<CreateBannerDto>): Promise<Banner> {
    const banner = await this.findOne(id);
    Object.assign(banner, {
      ...dto,
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
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
