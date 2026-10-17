import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { CARD_REWORK_PATCHES, planCardRework } from '../card-rework-patches';

/**
 * Retravail des cartes PipouSquad / SquareWorld (spec 2026-10-17-card-rework) :
 * effets, noms et descriptions. Chaque carte est retrouvée par son nom et
 * n'est modifiée que si elle est dans l'état de l'export de prod.
 */
export class CardRework1791000000004 implements MigrationInterface {
  name = 'CardRework1791000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyRework(queryRunner, 'up');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyRework(queryRunner, 'down');
  }
}

async function applyRework(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
): Promise<void> {
  const logger = new Logger('CardRework');
  for (const patch of CARD_REWORK_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `effects` FROM `card` WHERE `name` IN (?, ?)',
      [from.name, to.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      effects: unknown;
    }[];
    const current = rows[0];
    const decision = planCardRework(current, patch, direction);
    if (decision === 'apply') {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `effects` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.effects === null ? null : JSON.stringify(to.effects),
          current.id,
        ],
      );
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte « ${from.name} » : absente ou différente de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
