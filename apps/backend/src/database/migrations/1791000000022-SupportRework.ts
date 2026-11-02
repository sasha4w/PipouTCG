import { MigrationInterface, QueryRunner } from 'typeorm';

const SLOTS: [string, 'OFFENSIVE' | 'DEFENSIVE' | 'ACCESSORY'][] = [
  ['Processeur de Calcul .bin', 'OFFENSIVE'],
  ['Canon à Particules .vxd', 'OFFENSIVE'],
  ['Module Bluetooth .v2', 'OFFENSIVE'],
  ['Firewall .sys', 'DEFENSIVE'],
  ['Firewall de Surcharge .sys', 'DEFENSIVE'],
  ['Écaille de Dragon', 'DEFENSIVE'],
  ['Module de Réparation .exe', 'ACCESSORY'],
];

/** Terrains → Persistants, emplacements d'équipement, type Charge. */
export class SupportRework1791000000022 implements MigrationInterface {
  name = 'SupportRework1791000000022';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN','PERSISTENT','CHARGE') NULL",
    );
    await q.query(
      "ALTER TABLE `card` ADD `equipment_slot` enum ('OFFENSIVE','DEFENSIVE','ACCESSORY') NULL DEFAULT NULL, ADD `is_terrain` tinyint NOT NULL DEFAULT 0, ADD `charge_max` int NULL DEFAULT NULL, ADD `charge_mode` enum ('ONE_SHOT','CYCLIC') NULL DEFAULT NULL",
    );
    await q.query(
      "UPDATE `card` SET `support_type` = 'PERSISTENT', `is_terrain` = 1 WHERE `support_type` = 'TERRAIN'",
    );
    for (const [name, slot] of SLOTS)
      await q.query(
        "UPDATE `card` SET `equipment_slot` = ? WHERE TRIM(`name`) = ? AND `support_type` = 'EQUIPMENT'",
        [slot, name],
      );
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','PERSISTENT','CHARGE') NULL",
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Les FK vers `card` sont NO ACTION : on ne supprime pas les Charges.
    const [{ n }] = (await q.query(
      "SELECT COUNT(*) AS n FROM `card` WHERE `support_type` = 'CHARGE'",
    )) as { n: string | number }[];
    if (Number(n) > 0)
      throw new Error('Des cartes Charge existent : rollback manuel requis');
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN','PERSISTENT','CHARGE') NULL",
    );
    await q.query(
      "UPDATE `card` SET `support_type` = 'TERRAIN' WHERE `support_type` = 'PERSISTENT'",
    );
    await q.query(
      "ALTER TABLE `card` DROP COLUMN `charge_mode`, DROP COLUMN `charge_max`, DROP COLUMN `is_terrain`, DROP COLUMN `equipment_slot`",
    );
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN') NULL",
    );
  }
}
