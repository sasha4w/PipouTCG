import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { PROTOCOLE_DELTA, SECRETES_PATCHES } from '../secretes-2026-11-patches';

/** Carte signature d'un adversaire (nom dans le JSON `signature`). */
const SIGNATURE_JOIN =
  "JOIN `card` `c` ON `c`.`name` = JSON_UNQUOTE(JSON_EXTRACT(`o`.`signature`, '$.cardName'))";
/** Le Drakon des Origines avait déjà son butin avant ce patch : on n'y touche pas. */
const ALREADY_FARMED = 'Drakon des Origines';
const PROTOCOLE_COPIES = 2;

/** Magouille et Delta renforcés, Protocole Delta .core, butin secret des boss de niveau 5. */
export class SecretesBoss1791000000032 implements MigrationInterface {
  name = 'SecretesBoss1791000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('SecretesBoss');
    await applyBalancePatches(queryRunner, SECRETES_PATCHES, 'up', logger);

    const c = PROTOCOLE_DELTA;
    const exists = (await queryRunner.query(
      'SELECT `id` FROM `card` WHERE `name` = ?',
      [c.name],
    )) as unknown[];
    if (exists.length === 0) {
      const [ref] = (await queryRunner.query(
        'SELECT `card_set_id` FROM `card` WHERE `name` = ?',
        [c.setOf],
      )) as { card_set_id: number }[];
      if (!ref) logger.warn(`${c.setOf} introuvable : « ${c.name} » non créée`);
      else
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

    // Boss de niveau 5 à signature secrète : sa carte tombe à 1 %.
    await queryRunner.query(
      `UPDATE \`adventure_opponent\` \`o\` ${SIGNATURE_JOIN} SET \`o\`.\`farm_card_id\` = \`c\`.\`id\`, \`o\`.\`farm_card_pct\` = 1 WHERE \`o\`.\`position\` = 5 AND \`c\`.\`rarity\` = 'secret' AND \`o\`.\`farm_card_id\` IS NULL`,
    );

    // Boss à signature Noyau Delta : Protocole Delta .core ×2 dans son deck.
    await queryRunner.query(
      `INSERT INTO \`adventure_opponent_card\` (\`opponent_id\`, \`card_id\`, \`quantity\`) SELECT \`o\`.\`id\`, \`p\`.\`id\`, ? FROM \`adventure_opponent\` \`o\` ${SIGNATURE_JOIN} JOIN \`card\` \`p\` ON \`p\`.\`name\` = ? WHERE \`c\`.\`name\` = 'Noyau Delta' AND NOT EXISTS (SELECT 1 FROM \`adventure_opponent_card\` \`x\` WHERE \`x\`.\`opponent_id\` = \`o\`.\`id\` AND \`x\`.\`card_id\` = \`p\`.\`id\`)`,
      [PROTOCOLE_COPIES, c.name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('SecretesBoss');
    const c = PROTOCOLE_DELTA;

    await queryRunner.query(
      `DELETE \`x\` FROM \`adventure_opponent_card\` \`x\` JOIN \`adventure_opponent\` \`o\` ON \`o\`.\`id\` = \`x\`.\`opponent_id\` ${SIGNATURE_JOIN} JOIN \`card\` \`p\` ON \`p\`.\`id\` = \`x\`.\`card_id\` WHERE \`c\`.\`name\` = 'Noyau Delta' AND \`p\`.\`name\` = ?`,
      [c.name],
    );

    await queryRunner.query(
      `UPDATE \`adventure_opponent\` \`o\` ${SIGNATURE_JOIN} SET \`o\`.\`farm_card_id\` = NULL, \`o\`.\`farm_card_pct\` = 0 WHERE \`o\`.\`position\` = 5 AND \`c\`.\`rarity\` = 'secret' AND \`o\`.\`farm_card_id\` = \`c\`.\`id\` AND \`c\`.\`name\` <> ?`,
      [ALREADY_FARMED],
    );

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

    await applyBalancePatches(queryRunner, SECRETES_PATCHES, 'down', logger);
  }
}
