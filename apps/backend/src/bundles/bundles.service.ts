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
import { UpdateBundleContentDto } from './dto/update-bundle-content.dto';
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Calcule le total des items d'un bundle (somme de toutes les quantities) */
  private async getBundleTotalItems(bundleId: number): Promise<number> {
    const contents = await this.bundleContentRepository.find({
      where: { bundle: { id: bundleId } },
    });
    return contents.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
  }

  // ── CRUD Bundle ─────────────────────────────────────────────────────────────

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
      relations: { contents: { card: true, booster: true } },
    });
    if (!bundle) throw new NotFoundException(`Bundle ${id} introuvable`);
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
    return { message: `Bundle ${id} supprimé` };
  }

  // ── Gestion du contenu ─────────────────────────────────────────────────────

  /** Ajoute des items au bundle — pas de minimum requis ici */
  async addContent(bundleId: number, dto: AddBundleContentDto) {
    const bundle = await this.findOne(bundleId);

    for (const item of dto.items) {
      if (!!item.cardId === !!item.boosterId) {
        throw new BadRequestException(
          'Chaque item doit avoir soit un cardId soit un boosterId, pas les deux',
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

  /** Modifie la quantity d'un bundle_content existant */
  async updateContent(
    bundleId: number,
    contentId: number,
    dto: UpdateBundleContentDto,
  ) {
    const content = await this.bundleContentRepository.findOne({
      where: { id: contentId, bundle: { id: bundleId } },
      relations: { bundle: true },
    });
    if (!content)
      throw new NotFoundException(
        `BundleContent ${contentId} introuvable dans le bundle ${bundleId}`,
      );

    content.quantity = dto.quantity;
    await this.bundleContentRepository.save(content);

    return this.findOne(bundleId);
  }

  /** Supprime un bundle_content — le bundle reste valide même si total < 2, il sera juste non-ouvrable */
  async removeContent(bundleId: number, contentId: number) {
    const content = await this.bundleContentRepository.findOne({
      where: { id: contentId, bundle: { id: bundleId } },
      relations: { bundle: true },
    });
    if (!content)
      throw new NotFoundException(
        `BundleContent ${contentId} introuvable dans le bundle ${bundleId}`,
      );

    await this.bundleContentRepository.remove(content);

    // Info pour que l'admin sache si le bundle est toujours utilisable
    const totalRemaining = await this.getBundleTotalItems(bundleId);
    const updatedBundle = await this.findOne(bundleId);

    return {
      bundle: updatedBundle,
      warning:
        totalRemaining < 2
          ? `⚠️ Ce bundle n'a plus que ${totalRemaining} item(s) au total — il ne pourra pas être ouvert tant qu'il n'a pas au moins 2 items.`
          : null,
    };
  }

  // ── Achat / Ouverture ──────────────────────────────────────────────────────

  async buyBundle(bundleId: number, userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} introuvable`);

    const bundle = await this.findOne(bundleId);

    if (Number(user.gold) < bundle.price) {
      throw new BadRequestException('Pas assez de gold.');
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

    // Vérifie que le bundle a au moins 2 items au total toutes lignes confondues
    const totalItems = bundle.contents.reduce(
      (sum, c) => sum + (c.quantity ?? 1),
      0,
    );
    if (totalItems < 2) {
      throw new BadRequestException(
        `Ce bundle contient seulement ${totalItems} item(s). Il faut au moins 2 items pour pouvoir l'ouvrir.`,
      );
    }

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
