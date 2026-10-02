import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { CARD_EFFECT_PATCHES, planPatch } from '../card-effect-patches';

/**
 * Remplace les comportements codés en dur (#9, #17, #29, #122) et les
 * conditions « Sur X » des équipements (#127, #128) par des effets génériques.
 * Une carte modifiée depuis le dump du 23/09 n'est pas touchée : elle est
 * signalée dans les logs pour être corrigée via l'admin.
 */
export class GenericCardEffects1791000000001 implements MigrationInterface {
  name = 'GenericCardEffects1791000000001';

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
  const logger = new Logger('GenericCardEffects');
  for (const patch of CARD_EFFECT_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `effects` FROM `card` WHERE `id` = ?',
      [patch.cardId],
    )) as { effects: unknown }[];

    const decision = planPatch(rows[0]?.effects, from, to);
    if (decision === 'apply') {
      await queryRunner.query(
        'UPDATE `card` SET `effects` = ? WHERE `id` = ?',
        [JSON.stringify(to), patch.cardId],
      );
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte #${patch.cardId} (${patch.cardName}) : effets différents de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
