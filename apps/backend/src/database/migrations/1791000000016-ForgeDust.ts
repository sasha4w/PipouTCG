import { MigrationInterface, QueryRunner } from 'typeorm';

/** Forge : poussière et compteurs de forge / destruction sur `user`. */
export class ForgeDust1791000000016 implements MigrationInterface {
  name = 'ForgeDust1791000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user` ADD `dust` bigint NOT NULL DEFAULT 0, ADD `dust_earned` bigint NOT NULL DEFAULT 0, ADD `cards_forged` int NOT NULL DEFAULT 0, ADD `cards_destroyed` int NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user` DROP COLUMN `cards_destroyed`, DROP COLUMN `cards_forged`, DROP COLUMN `dust_earned`, DROP COLUMN `dust`',
    );
  }
}
