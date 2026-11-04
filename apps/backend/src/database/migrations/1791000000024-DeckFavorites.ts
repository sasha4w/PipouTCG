import { MigrationInterface, QueryRunner } from 'typeorm';

/** Decks favoris et dernier deck utilisé (spec 2026-11-04-deck-builder-rework). */
export class DeckFavorites1791000000024 implements MigrationInterface {
  name = 'DeckFavorites1791000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `deck` ADD `is_favorite` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `deck` ADD `last_used_at` timestamp NULL DEFAULT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `deck` DROP COLUMN `last_used_at`');
    await queryRunner.query('ALTER TABLE `deck` DROP COLUMN `is_favorite`');
  }
}
