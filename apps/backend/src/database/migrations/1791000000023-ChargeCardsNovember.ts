import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { CHARGE_NEW_CARDS, NOVEMBER_PATCHES } from '../cartes-2026-11-patches';

/** Textes clarifiés (Bluetooth, Œuf Céleste) et cartes Charge de novembre. */
export class ChargeCardsNovember1791000000023 implements MigrationInterface {
  name = 'ChargeCardsNovember1791000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('ChargeCardsNovember');
    await applyBalancePatches(queryRunner, NOVEMBER_PATCHES, 'up', logger);
    for (const c of CHARGE_NEW_CARDS) {
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
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `support_type`, `charge_max`, `charge_mode`, `archetype`, `effects`, `description`, `card_set_id`) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)',
        [
          c.name,
          c.rarity,
          'support',
          'CHARGE',
          c.chargeMax,
          c.chargeMode,
          c.archetype,
          JSON.stringify(c.effects),
          c.description,
          ref.card_set_id,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('ChargeCardsNovember');
    for (const c of CHARGE_NEW_CARDS) {
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
    await applyBalancePatches(queryRunner, NOVEMBER_PATCHES, 'down', logger);
  }
}
