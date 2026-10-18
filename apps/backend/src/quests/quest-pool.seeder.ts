import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Quest } from './quest.entity';
import { QUEST_POOL, poolQuestFields } from './quest-pool';

/** Synchronise le pool de quêtes défini en code (par pool_key) à chaque démarrage. */
@Injectable()
export class QuestPoolSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestPoolSeeder.name);

  constructor(
    @InjectRepository(Quest) private readonly questRepo: Repository<Quest>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
    } catch (err) {
      this.logger.error(
        'Synchronisation du pool de quêtes en échec',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async seed(): Promise<void> {
    const existing = await this.questRepo.find({
      where: { poolKey: In(QUEST_POOL.map((p) => p.poolKey)) },
    });
    const byKey = new Map(existing.map((q) => [q.poolKey, q]));
    const quests = QUEST_POOL.map((p) => {
      const fields = poolQuestFields(p);
      const current = byKey.get(p.poolKey);
      return current
        ? Object.assign(current, fields)
        : this.questRepo.create({ ...fields, isActive: true });
    });
    await this.questRepo.save(quests);
  }
}
