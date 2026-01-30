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

@Injectable()
export class BundlesService {
  constructor(
    @InjectRepository(Bundle)
    private bundleRepository: Repository<Bundle>,

    @InjectRepository(BundleContent)
    private bundleContentRepository: Repository<BundleContent>,
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
}
