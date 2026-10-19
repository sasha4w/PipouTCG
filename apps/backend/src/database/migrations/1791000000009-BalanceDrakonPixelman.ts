import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  BALANCE_NEW_CARDS,
  BALANCE_PATCHES,
  planBalancePatch,
} from '../balance-2026-10-patches';

/** Rééquilibrage Drakon / Pixelman / Zeta : 14 cartes mises à jour, 5 créées. */
export class BalanceDrakonPixelman1791000000009 implements MigrationInterface {
  name = 'BalanceDrakonPixelman1791000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('BalanceDrakonPixelman');
    await applyPatches(queryRunner, 'up', logger);
    for (const c of BALANCE_NEW_CARDS) {
      const exists = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as unknown[];
      if (exists.length > 0) continue;
      const [ref] = (await queryRunner.query(
        'SELECT `card_set_id` FROM `card` WHERE `name` = ?',
        [c.setOf],
      )) as { card_set_id: number }[];
      if (!ref) {
        logger.warn(`${c.setOf} introuvable : « ${c.name} » non créée`);
        continue;
      }
      await queryRunner.query(
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `support_type`, `archetype`, `effects`, `description`, `card_set_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          c.name,
          c.rarity,
          c.type,
          c.atk,
          c.hp,
          c.cost,
          c.supportType,
          c.archetype,
          JSON.stringify(c.effects),
          c.description,
          ref.card_set_id,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('BalanceDrakonPixelman');
    for (const c of BALANCE_NEW_CARDS) {
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
  for (const patch of BALANCE_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `atk`, `hp`, `cost`, `effects` FROM `card` WHERE `name` = ?',
      [from.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      atk: number;
      hp: number;
      cost: number;
      effects: unknown;
    }[];
    const current = rows[0];
    const decision = planBalancePatch(current, patch, direction);
    if (decision === 'apply' && current) {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `atk` = ?, `hp` = ?, `cost` = ?, `effects` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.atk,
          to.hp,
          to.cost,
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
