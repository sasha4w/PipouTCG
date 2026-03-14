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
import { UsersService } from '../users/users.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class BundlesService {
  constructor(
    @InjectRepository(Bundle)
    private bundleRepository: Repository<Bundle>,
    @InjectRepository(BundleContent)
    private bundleContentRepository: Repository<BundleContent>,
    private readonly usersService: UsersService,
  ) {}

  async findAll({ page = 1, limit = 20 }: PaginationDto = {}) {
    const [bundles, total] = await this.bundleRepository.findAndCount({
      relations: { contents: { card: true, booster: true } },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: bundles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
    const bundle = await this.findOne(bundleId);

    const totalQuantity = dto.items.reduce(
      (sum, item) => sum + (item.quantity ?? 1),
      0,
    );

    if (totalQuantity < 2) {
      throw new BadRequestException(
        'Un bundle doit contenir au moins 2 items au total',
      );
    }

    for (const item of dto.items) {
      if (!!item.cardId === !!item.boosterId) {
        throw new BadRequestException(
          'Chaque item doit avoir soit un cardId soit un boosterId',
        );
      }
      const content = this.bundleContentRepository.create({
        bundle,
        card: item.cardId ? ({ id: item.cardId } as any) : null,
        booster: item.boosterId ? ({ id: item.boosterId } as any) : null,
        quantity: item.quantity ?? 1,
      });
      await this.bundleContentRepository.save(content);
    }

    return this.findOne(bundleId);
  }

  async buyBundle(bundleId: number, userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const bundle = await this.findOne(bundleId);

    if (Number(user.gold) < bundle.price) {
      throw new BadRequestException(`Not enough gold.`);
    }

    await this.usersService.spendGoldAndRecordBundlePurchase(
      userId,
      bundle.price,
    );
    await this.usersService.addBundleToUser(userId, bundleId, 1);

    return {
      message: `Bundle "${bundle.name}" acheté avec succès`,
      goldSpent: bundle.price,
      goldRemaining: Number(user.gold) - bundle.price,
    };
  }

  async openBundle(bundleId: number, userId: number) {
    const bundle = await this.findOne(bundleId);

    await this.bundleContentRepository.manager.transaction(async (manager) => {
      await this.usersService.removeBundleFromUser(userId, bundleId, manager);

      for (const content of bundle.contents) {
        if (content.card) {
          await this.usersService.addCardToUser(
            userId,
            content.card.id,
            content.quantity,
            manager,
          );
        }
        if (content.booster) {
          await this.usersService.addBoosterToUser(
            userId,
            content.booster.id,
            content.quantity,
            manager,
          );
        }
      }
    });

    await this.usersService.addExperience(userId, 100);

    return {
      message: `Bundle "${bundle.name}" ouvert avec succès`,
      cards: bundle.contents
        .filter((c) => c.card)
        .map((c) => ({ name: c.card.name, quantity: c.quantity })),
      boosters: bundle.contents
        .filter((c) => c.booster)
        .map((c) => ({ name: c.booster.name, quantity: c.quantity })),
    };
  }
}
