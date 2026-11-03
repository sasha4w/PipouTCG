import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DrakonStage } from '@pipou/shared';
import { Card } from '../../cards/card.entity';
import { setEvolutionCatalog } from '../helpers/evolution-catalog';

/** Charge les Jeunes, Adultes et Ancestraux pour l'évolution sans carte. */
@Injectable()
export class EvolutionCatalogLoader implements OnApplicationBootstrap {
  constructor(@InjectRepository(Card) private cards: Repository<Card>) {}

  async onApplicationBootstrap(): Promise<void> {
    setEvolutionCatalog(
      await this.cards.find({
        where: {
          stage: In([
            DrakonStage.YOUNG,
            DrakonStage.ADULT,
            DrakonStage.ANCESTRAL,
          ]),
        },
      }),
    );
  }
}
