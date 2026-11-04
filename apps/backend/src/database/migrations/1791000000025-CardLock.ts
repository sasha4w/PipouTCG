import { MigrationInterface, QueryRunner } from 'typeorm';

/** Verrou de copies de collection (spec 2026-10-25-page-collection). */
export class CardLock1791000000025 implements MigrationInterface {
  name = 'CardLock1791000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_card` ADD `locked_quantity` int NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_card` DROP COLUMN `locked_quantity`',
    );
  }
}
