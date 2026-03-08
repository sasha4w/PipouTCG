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

    // On centralise toute la manipulation de l'inventaire ici
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
    // 1. Récupération des infos (via UsersService pour le user)
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const bundle = await this.findOne(bundleId);

    // 2. Vérification Gold
    if (Number(user.gold) < bundle.price) {
      throw new BadRequestException(`Not enough gold.`);
    }

    // 3. Paiement et Stats via UsersService
    await this.usersService.spendGoldAndRecordBundlePurchase(
      userId,
      bundle.price,
    );

    // 4. Ajout à l'inventaire via UsersService
    await this.usersService.addBundleToUser(userId, bundleId, 1);

    return {
      message: `Bundle "${bundle.name}" acheté avec succès`,
      goldSpent: bundle.price,
      goldRemaining: Number(user.gold) - bundle.price,
    };
  }
  // ============================================================
  // OUVERTURE D'UN BUNDLE
  // Vérifie l'inventaire → -1 user_bundle → distribue les contenus
  // cartes → user_card | boosters → user_booster (selon quantity)
  // ============================================================
  async openBundle(bundleId: number, userId: number) {
    // 1. Récupérer la définition du bundle
    const bundle = await this.findOne(bundleId);

    // 2. Retirer le bundle de l'inventaire via UsersService
    // (C'est ICI que tes erreurs disparaissent car on n'appelle plus "this.userBundleRepository")
    await this.usersService.removeBundleFromUser(userId, bundleId);

    // 3. Distribuer le contenu (Cartes + Boosters) via UsersService
    const summary = await this.usersService.distributeBundleContents(
      userId,
      bundle.contents,
    );

    // 4. Bonus XP
    await this.usersService.addExperience(userId, 100);

    return {
      message: `Bundle "${bundle.name}" ouvert avec succès`,
      cards: summary.cards,
      boosters: summary.boosters,
    };
  }
}
