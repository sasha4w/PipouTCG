import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { PROTOCOLE_DELTA, SECRETES_PATCHES } from '../secretes-2026-11-patches';

/** Archétype du boss (JSON `signature`). */
const ARCHETYPE = "JSON_UNQUOTE(JSON_EXTRACT(`o`.`signature`, '$.archetype'))";
/** Le boss de niveau 5 est à la position 5 de son monde. */
const BOSS_POSITION = 5;
/** Cartes ajoutées au deck du boss de niveau 5, par archétype. */
const BOSS_DECK_CARDS: { archetype: string; card: string; quantity: number }[] =
  [
    { archetype: 'pipou', card: 'Maître Magouille', quantity: 1 },
    { archetype: 'pixelman', card: 'Noyau Delta', quantity: 1 },
    { archetype: 'pixelman', card: PROTOCOLE_DELTA.name, quantity: 2 },
  ];
/**
 * Butin secret par archétype, figé ici : une migration ne doit pas changer
 * quand le code applicatif (`BOSS_SECRET_CARD`) évolue.
 */
const SECRETS: [string, string][] = [
  ['pipou', 'Maître Magouille'],
  ['pixelman', 'Noyau Delta'],
];

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

    // Boss de niveau 5 : la carte secrète de son archétype tombe à 1 %.
    for (const [archetype, name] of SECRETS)
      await queryRunner.query(
        `UPDATE \`adventure_opponent\` \`o\` JOIN \`card\` \`c\` ON \`c\`.\`name\` = ? SET \`o\`.\`farm_card_id\` = \`c\`.\`id\`, \`o\`.\`farm_card_pct\` = 1 WHERE \`o\`.\`position\` = ? AND ${ARCHETYPE} = ? AND \`c\`.\`rarity\` = 'secret' AND \`o\`.\`farm_card_id\` IS NULL`,
        [name, BOSS_POSITION, archetype],
      );

    // Deck du boss de niveau 5 : sa secrète (et Protocole Delta .core ×2 côté Pixelman).
    for (const d of BOSS_DECK_CARDS)
      await queryRunner.query(
        `INSERT INTO \`adventure_opponent_card\` (\`opponent_id\`, \`card_id\`, \`quantity\`) SELECT \`o\`.\`id\`, \`p\`.\`id\`, ? FROM \`adventure_opponent\` \`o\` JOIN \`card\` \`p\` ON \`p\`.\`name\` = ? WHERE \`o\`.\`position\` = ? AND ${ARCHETYPE} = ? AND NOT EXISTS (SELECT 1 FROM \`adventure_opponent_card\` \`x\` WHERE \`x\`.\`opponent_id\` = \`o\`.\`id\` AND \`x\`.\`card_id\` = \`p\`.\`id\`)`,
        [d.quantity, d.card, BOSS_POSITION, d.archetype],
      );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('SecretesBoss');
    const c = PROTOCOLE_DELTA;

    // Seules les lignes de Protocole Delta .core sont sûrement de cette migration :
    // le deck d'un boss pouvait déjà contenir sa secrète (Magouille chez le boss pipou).
    for (const d of BOSS_DECK_CARDS.filter(
      (x) => x.card === PROTOCOLE_DELTA.name,
    ))
      await queryRunner.query(
        `DELETE \`x\` FROM \`adventure_opponent_card\` \`x\` JOIN \`adventure_opponent\` \`o\` ON \`o\`.\`id\` = \`x\`.\`opponent_id\` JOIN \`card\` \`p\` ON \`p\`.\`id\` = \`x\`.\`card_id\` WHERE \`o\`.\`position\` = ? AND ${ARCHETYPE} = ? AND \`p\`.\`name\` = ?`,
        [BOSS_POSITION, d.archetype, d.card],
      );

    for (const [archetype, name] of SECRETS)
      await queryRunner.query(
        `UPDATE \`adventure_opponent\` \`o\` JOIN \`card\` \`c\` ON \`c\`.\`id\` = \`o\`.\`farm_card_id\` SET \`o\`.\`farm_card_id\` = NULL, \`o\`.\`farm_card_pct\` = 0 WHERE \`o\`.\`position\` = ? AND ${ARCHETYPE} = ? AND \`c\`.\`name\` = ?`,
        [BOSS_POSITION, archetype, name],
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
