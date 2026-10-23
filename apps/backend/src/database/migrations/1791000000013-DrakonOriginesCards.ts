import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { DRAKON_ORIGINES_CARDS } from '../drakon-origines-cards';

/** Extension Drakon : 4 Ancestraux et le Drakon des Origines, sans image. */
export class DrakonOriginesCards1791000000013 implements MigrationInterface {
  name = 'DrakonOriginesCards1791000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonOriginesCards');
    for (const c of DRAKON_ORIGINES_CARDS) {
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
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `support_type`, `archetype`, `effects`, `description`, `stage`, `element`, `lineage`, `card_set_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          c.name,
          c.rarity,
          'monster',
          c.atk,
          c.hp,
          c.cost,
          null,
          'dragon',
          JSON.stringify(c.effects),
          c.description,
          c.stage,
          c.element,
          c.lineage,
          ref.card_set_id,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonOriginesCards');
    for (const c of DRAKON_ORIGINES_CARDS) {
      const rows = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as { id: number }[];
      for (const { id } of rows) {
        const [{ used }] = (await queryRunner.query(
          'SELECT (SELECT COUNT(*) FROM `user_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `booster_open_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `bundle_content` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `adventure_opponent_card` WHERE `card_id` = ?) AS used',
          [id, id, id, id],
        )) as { used: number | string }[];
        if (Number(used) > 0) {
          logger.warn(`« ${c.name} » est référencée : non supprimée`);
          continue;
        }
        await queryRunner.query('DELETE FROM `card` WHERE `id` = ?', [id]);
      }
    }
  }
}
