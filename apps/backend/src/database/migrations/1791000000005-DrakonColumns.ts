import { MigrationInterface, QueryRunner } from 'typeorm';

/** Élément, lignée et stade des cartes Drakon (spec 2026-10-17-drakon-set). */
export class DrakonColumns1791000000005 implements MigrationInterface {
  name = 'DrakonColumns1791000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `card` ADD `element` enum ('earth', 'fire', 'wind', 'water') NULL DEFAULT NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `card` ADD `lineage` varchar(50) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      "ALTER TABLE `card` ADD `stage` enum ('egg', 'baby', 'young', 'adult') NULL DEFAULT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `stage`');
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `lineage`');
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `element`');
  }
}
