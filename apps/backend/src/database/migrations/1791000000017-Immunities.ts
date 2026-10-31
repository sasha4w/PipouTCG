import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { planPatch } from '../card-effect-patches';
import { IMMUNITY_PATCHES } from '../immunities-2026-10-patches';

/**
 * Remplace l'immunité unique « aux effets adverses » par des immunités
 * différenciées sur Maître Magouille, Adulte/Ancestral Teros, Écaille de
 * Dragon et Drakon des Origines. Une carte modifiée depuis est signalée
 * dans les logs sans être touchée.
 */
export class Immunities1791000000017 implements MigrationInterface {
  name = 'Immunities1791000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyPatches(queryRunner, 'up');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyPatches(queryRunner, 'down');
  }
}

async function applyPatches(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
): Promise<void> {
  const logger = new Logger('Immunities');
  const up = direction === 'up';
  for (const patch of IMMUNITY_PATCHES) {
    const [from, to] = up
      ? [patch.before, patch.after]
      : [patch.after, patch.before];
    const [descFrom, descTo] = up
      ? [patch.descriptionBefore, patch.descriptionAfter]
      : [patch.descriptionAfter, patch.descriptionBefore];
    const rows = (await queryRunner.query(
      'SELECT `effects`, `description` FROM `card` WHERE `id` = ?',
      [patch.cardId],
    )) as { effects: unknown; description: string }[];

    const decision = planPatch(rows[0]?.effects, from, to);
    if (decision === 'apply') {
      await queryRunner.query(
        'UPDATE `card` SET `effects` = ? WHERE `id` = ?',
        [JSON.stringify(to), patch.cardId],
      );
      if (rows[0]?.description === descFrom) {
        await queryRunner.query(
          'UPDATE `card` SET `description` = ? WHERE `id` = ?',
          [descTo, patch.cardId],
        );
      }
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte #${patch.cardId} (${patch.cardName}) : effets différents de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
