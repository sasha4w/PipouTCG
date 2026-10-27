import { MigrationInterface, QueryRunner } from 'typeorm';

/** Revue de l'IA : décisions journalisées et annotations admin. */
export class AiReview1791000000017 implements MigrationInterface {
  name = 'AiReview1791000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `ai_decision` (`id` varchar(96) NOT NULL, `game_id` varchar(64) NOT NULL, `user_id` int NOT NULL, `turn` int NOT NULL, `phase` varchar(16) NOT NULL, `seat` varchar(4) NOT NULL, `archetype` varchar(16) NOT NULL, `level` int NOT NULL, `source` varchar(16) NOT NULL, `chosen` json NOT NULL, `chosen_text` varchar(255) NOT NULL, `candidates` json NOT NULL, `baseline` double NULL, `regret` double NOT NULL, `simulation_crashes` json NOT NULL, `state_gz` longblob NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_ai_decision_game` (`game_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `ai_annotation` (`id` int NOT NULL AUTO_INCREMENT, `decision_id` varchar(96) NOT NULL, `user_id` int NOT NULL, `verdict` varchar(24) NOT NULL, `preferred` json NULL, `category` varchar(32) NULL, `comment` text NULL, `outcome` varchar(8) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_ai_annotation_decision` (`decision_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `ai_annotation`');
    await queryRunner.query('DROP TABLE `ai_decision`');
  }
}
