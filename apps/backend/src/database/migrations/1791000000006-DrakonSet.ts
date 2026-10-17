import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DRAKON_NEW_CARDS,
  DRAKON_PATCHES,
  planDrakonPatch,
} from '../drakon-set-patches';

/** Set Drakon (spec 2026-10-17-drakon-set) : 19 cartes mises à jour, 2 œufs créés. */
export class DrakonSet1791000000006 implements MigrationInterface {
  name = 'DrakonSet1791000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonSet');
    await applyPatches(queryRunner, 'up', logger);
    const [ref] = (await queryRunner.query(
      'SELECT `card_set_id` FROM `card` WHERE `name` = ?',
      ['Bébé Teros'],
    )) as { card_set_id: number }[];
    if (!ref) {
      logger.warn('Bébé Teros introuvable : œufs non créés');
      return;
    }
    for (const c of DRAKON_NEW_CARDS) {
      const exists = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as unknown[];
      if (exists.length > 0) continue;
      await queryRunner.query(
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `archetype`, `effects`, `description`, `card_set_id`, `stage`) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)',
        [
          c.name,
          c.rarity,
          'monster',
          c.hp,
          c.cost,
          'dragon',
          JSON.stringify(c.effects),
          c.description,
          ref.card_set_id,
          'egg',
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonSet');
    for (const c of DRAKON_NEW_CARDS) {
      const rows = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as { id: number }[];
      for (const { id } of rows) {
        const [{ used }] = (await queryRunner.query(
          'SELECT (SELECT COUNT(*) FROM `user_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `booster_open_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `bundle_content` WHERE `card_id` = ?) AS used',
          [id, id, id],
        )) as { used: number | string }[];
        if (Number(used) > 0) {
          logger.warn(`« ${c.name} » est référencée : non supprimée`);
          continue;
        }
        await queryRunner.query('DELETE FROM `card` WHERE `id` = ?', [id]);
      }
    }
    await applyPatches(queryRunner, 'down', logger);
  }
}

async function applyPatches(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
  logger: Logger,
): Promise<void> {
  for (const patch of DRAKON_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `hp`, `effects`, `element`, `lineage`, `stage` FROM `card` WHERE `name` IN (?, ?)',
      [from.name, to.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      hp: number;
      effects: unknown;
      element: string | null;
      lineage: string | null;
      stage: string | null;
    }[];
    const current = rows.find(
      (r) => r.name === from.name || r.name === to.name,
    );
    const decision = planDrakonPatch(current, patch, direction);
    if (decision === 'apply' && current) {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `hp` = ?, `effects` = ?, `element` = ?, `lineage` = ?, `stage` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.hp,
          to.effects === null ? null : JSON.stringify(to.effects),
          to.element,
          to.lineage,
          to.stage,
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
