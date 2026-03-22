import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booster } from '../boosters/booster.entity';
import { Bundle } from '../bundles/bundle.entity';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Booster)
    private boosterRepository: Repository<Booster>,
    @InjectRepository(Bundle)
    private bundleRepository: Repository<Bundle>,
  ) {}

  /** Retourne le catalogue complet boosters + bundles */
  async getCatalog() {
    const [boosters, bundles] = await Promise.all([
      this.boosterRepository.find({
        relations: { cardSet: true },
        order: { id: 'ASC' },
      }),
      this.bundleRepository.find({
        relations: { contents: { card: true, booster: true } },
        order: { id: 'ASC' },
      }),
    ]);

    return {
      boosters: boosters.map((b) => ({
        id: b.id,
        name: b.name,
        cardNumber: b.cardNumber,
        price: b.price,
        cardSetName: b.cardSet?.name ?? '',
      })),
      bundles: bundles.map((b) => ({
        id: b.id,
        name: b.name,
        price: b.price,
        contents: b.contents.map((c) => ({
          itemType: c.card ? 'card' : 'booster',
          itemName: c.card?.name ?? c.booster?.name ?? '',
          quantity: c.quantity,
        })),
      })),
    };
  }
}
