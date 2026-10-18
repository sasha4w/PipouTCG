import { MigrationInterface, QueryRunner } from 'typeorm';

/** Mode Aventure PvE : mondes, adversaires IA, decks, combats, réglages. */
export class Adventure1791000000008 implements MigrationInterface {
  name = 'Adventure1791000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `adventure_world` (`id` int NOT NULL AUTO_INCREMENT, `name` varchar(100) NOT NULL, `card_set_id` int NOT NULL, `booster_id` int NULL DEFAULT NULL, `sort_order` int NOT NULL DEFAULT 0, `is_active` tinyint(1) NOT NULL DEFAULT 1, PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `adventure_world_prerequisite` (`world_id` int NOT NULL, `required_world_id` int NOT NULL, INDEX `IDX_6646914fa4a02b1ab6af3ef3f5` (`world_id`), INDEX `IDX_ae56b41b192ac89d7c62393d90` (`required_world_id`), PRIMARY KEY (`world_id`, `required_world_id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `adventure_opponent` (`id` int NOT NULL AUTO_INCREMENT, `world_id` int NOT NULL, `position` int NOT NULL, `name` varchar(100) NOT NULL, `quote` varchar(255) NOT NULL, `portrait_card_id` int NULL DEFAULT NULL, `signature` varchar(32) NOT NULL, `first_win_gold` int NOT NULL DEFAULT 0, `first_win_xp` int NOT NULL DEFAULT 0, `farm_gold` int NOT NULL DEFAULT 0, `farm_xp` int NOT NULL DEFAULT 0, `farm_booster_pct` decimal(5,2) NOT NULL DEFAULT 0, `farm_legendary_pct` decimal(5,2) NOT NULL DEFAULT 0, UNIQUE INDEX `UQ_adventure_opponent_position` (`world_id`, `position`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `adventure_opponent_card` (`id` int NOT NULL AUTO_INCREMENT, `opponent_id` int NOT NULL, `card_id` int NOT NULL, `quantity` int NOT NULL DEFAULT 1, UNIQUE INDEX `UQ_adventure_opponent_card` (`opponent_id`, `card_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `adventure_match` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `opponent_id` int NOT NULL, `won` tinyint(1) NULL DEFAULT NULL, `first_win` tinyint(1) NOT NULL DEFAULT 0, `end_reason` varchar(32) NULL DEFAULT NULL, `turns` int NOT NULL DEFAULT 0, `loot` json NULL, `rewarded` tinyint(1) NOT NULL DEFAULT 0, `started_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `ended_at` datetime NULL DEFAULT NULL, INDEX `idx_adventure_match_user_opponent` (`user_id`, `opponent_id`), INDEX `idx_adventure_match_user_ended` (`user_id`, `ended_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `adventure_settings` (`id` int NOT NULL, `daily_cap` int NOT NULL DEFAULT 20, PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );

    await queryRunner.query(
      'ALTER TABLE `adventure_world` ADD CONSTRAINT `FK_adventure_world_card_set` FOREIGN KEY (`card_set_id`) REFERENCES `card_set`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_world` ADD CONSTRAINT `FK_adventure_world_booster` FOREIGN KEY (`booster_id`) REFERENCES `booster`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_world_prerequisite` ADD CONSTRAINT `FK_adventure_prereq_world` FOREIGN KEY (`world_id`) REFERENCES `adventure_world`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_world_prerequisite` ADD CONSTRAINT `FK_adventure_prereq_required` FOREIGN KEY (`required_world_id`) REFERENCES `adventure_world`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` ADD CONSTRAINT `FK_adventure_opponent_world` FOREIGN KEY (`world_id`) REFERENCES `adventure_world`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` ADD CONSTRAINT `FK_adventure_opponent_portrait` FOREIGN KEY (`portrait_card_id`) REFERENCES `card`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent_card` ADD CONSTRAINT `FK_adventure_opp_card_opponent` FOREIGN KEY (`opponent_id`) REFERENCES `adventure_opponent`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent_card` ADD CONSTRAINT `FK_adventure_opp_card_card` FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_match` ADD CONSTRAINT `FK_adventure_match_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_match` ADD CONSTRAINT `FK_adventure_match_opponent` FOREIGN KEY (`opponent_id`) REFERENCES `adventure_opponent`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'INSERT INTO `adventure_settings` (`id`, `daily_cap`) VALUES (1, 20)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `adventure_match`');
    await queryRunner.query('DROP TABLE `adventure_opponent_card`');
    await queryRunner.query('DROP TABLE `adventure_opponent`');
    await queryRunner.query('DROP TABLE `adventure_world_prerequisite`');
    await queryRunner.query('DROP TABLE `adventure_world`');
    await queryRunner.query('DROP TABLE `adventure_settings`');
  }
}
