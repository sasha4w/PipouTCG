import { MigrationInterface, QueryRunner } from 'typeorm';

/** Succès à paliers, pool de quêtes, titre équipé (spec 2026-10-18-quests-achievements-rework). */
export class QuestsAchievements1791000000007 implements MigrationInterface {
  name = 'QuestsAchievements1791000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `user_achievement` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `family` varchar(32) NOT NULL, `tier` enum ('BRONZE', 'SILVER', 'GOLD') NOT NULL, `claimed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_user_achievement_tier` (`user_id`, `family`, `tier`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'ALTER TABLE `user_achievement` ADD CONSTRAINT `FK_user_achievement_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `equipped_title` varchar(32) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `quests_completed` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `last_quest_reroll_at` datetime NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `quest` ADD `pool_key` varchar(64) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `quest` ADD UNIQUE INDEX `UQ_quest_pool_key` (`pool_key`)',
    );
    // Remplacées par les succès et le pool seedé ; l'admin peut les réactiver.
    await queryRunner.query(
      "UPDATE `quest` SET `is_active` = 0 WHERE `pool_key` IS NULL AND `reset_type` IN ('NONE', 'DAILY', 'WEEKLY')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `quest` DROP INDEX `UQ_quest_pool_key`',
    );
    await queryRunner.query('ALTER TABLE `quest` DROP COLUMN `pool_key`');
    await queryRunner.query(
      'ALTER TABLE `user` DROP COLUMN `last_quest_reroll_at`',
    );
    await queryRunner.query(
      'ALTER TABLE `user` DROP COLUMN `quests_completed`',
    );
    await queryRunner.query('ALTER TABLE `user` DROP COLUMN `equipped_title`');
    await queryRunner.query(
      'ALTER TABLE `user_achievement` DROP FOREIGN KEY `FK_user_achievement_user`',
    );
    await queryRunner.query('DROP TABLE `user_achievement`');
  }
}
