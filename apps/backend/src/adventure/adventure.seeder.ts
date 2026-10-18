import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Rarity, type AdventureArchetype } from '@pipou/shared';
import { DataSource, Repository } from 'typeorm';
import { Booster } from '../boosters/booster.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { Card } from '../cards/card.entity';
import { canActivateWorld } from './adventure-rules';
import { AdventureWorld } from './entities/adventure-world.entity';
import { LAUNCH_PERSONAS, LAUNCH_SIGNATURES } from './signatures';
import { persistWorld, planOpponents } from './world-factory';

export const LAUNCH_WORLDS: {
  cardSetId: number;
  archetype: AdventureArchetype;
  order: number;
}[] = [
  { cardSetId: 1, archetype: 'pipou', order: 1 },
  { cardSetId: 2, archetype: 'pixelman', order: 2 },
  { cardSetId: 3, archetype: 'dragon', order: 3 },
];

/**
 * Crée au démarrage les mondes de lancement manquants (jamais de mise à jour :
 * un monde existant pour un set appartient ensuite à l'admin).
 */
@Injectable()
export class AdventureSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdventureSeeder.name);
  /** Source de hasard des decks ; remplaçable en test. */
  random: () => number = Math.random;

  constructor(
    @InjectRepository(AdventureWorld)
    private readonly worldRepo: Repository<AdventureWorld>,
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
    @InjectRepository(CardSet) private readonly setRepo: Repository<CardSet>,
    @InjectRepository(Booster)
    private readonly boosterRepo: Repository<Booster>,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
    } catch (err) {
      this.logger.error(
        "Création des mondes d'aventure en échec",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async seed(): Promise<void> {
    const worlds = await this.worldRepo.find();
    const existing = new Set(worlds.map((w) => w.cardSetId));
    const sets = new Map((await this.setRepo.find()).map((s) => [s.id, s]));
    // Plus petit id de booster par set.
    const boosters = await this.boosterRepo.find({
      relations: { cardSet: true },
      order: { id: 'ASC' },
    });
    const boosterBySet = new Map<number, number>();
    for (const b of boosters) {
      const setId = b.cardSet?.id;
      if (setId !== undefined && !boosterBySet.has(setId))
        boosterBySet.set(setId, b.id);
    }

    for (const def of LAUNCH_WORLDS) {
      if (existing.has(def.cardSetId)) continue;
      const set = sets.get(def.cardSetId);
      if (!set) {
        this.logger.warn(
          `Set ${def.cardSetId} introuvable : monde ${def.archetype} ignoré`,
        );
        continue;
      }
      try {
        await this.createWorld(def, set, boosterBySet.get(set.id) ?? null);
      } catch (err) {
        this.logger.error(
          `Création du monde ${def.archetype} en échec`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async createWorld(
    def: (typeof LAUNCH_WORLDS)[number],
    set: CardSet,
    boosterId: number | null,
  ): Promise<void> {
    const setCards = await this.cardRepo.find({
      where: { cardSet: { id: set.id } },
    });
    const legendaryCount = setCards.filter(
      (c) => c.rarity === Rarity.LEGENDARY,
    ).length;

    // Tout est généré avant la 1re écriture : une erreur ne laisse pas de monde partiel.
    const plans = planOpponents(
      setCards,
      LAUNCH_SIGNATURES[def.archetype],
      this.random,
      (signature) =>
        this.logger.warn(
          `Portrait « ${signature.cardName} » introuvable dans le set ${set.id}`,
        ),
    );

    // Une transaction par monde : tout ou rien.
    await this.dataSource.transaction((manager) =>
      persistWorld(
        manager,
        {
          name: set.name,
          cardSetId: set.id,
          boosterId,
          order: def.order,
          isActive: canActivateWorld({ boosterId, legendaryCount }).ok,
        },
        plans,
        LAUNCH_PERSONAS[def.archetype],
      ),
    );
  }
}
