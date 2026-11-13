import { MigrationInterface, QueryRunner } from 'typeorm';

/** Défi du jour : défis, calendrier (un défi par jour) et résolutions par joueur. */
export class DailyPuzzle1791000000030 implements MigrationInterface {
  name = 'DailyPuzzle1791000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE IF NOT EXISTS `daily_puzzle` (`id` int NOT NULL AUTO_INCREMENT, `title` varchar(80) NOT NULL, `description` varchar(255) NULL, `state` json NOT NULL, `objective_type` varchar(24) NOT NULL, `objective_params` json NOT NULL, `seed` int NOT NULL, `reward_gold` int NOT NULL DEFAULT 100, `reward_xp` int NOT NULL DEFAULT 50, `status` varchar(12) NOT NULL DEFAULT 'draft', `verified_at` datetime NULL, `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `created_by_id` int NULL, INDEX `idx_daily_puzzle_status` (`status`), PRIMARY KEY (`id`), CONSTRAINT `fk_daily_puzzle_user` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `daily_puzzle_schedule` (`id` int NOT NULL AUTO_INCREMENT, `date` varchar(10) NOT NULL, `puzzle_id` int NOT NULL, `origin` varchar(8) NOT NULL, UNIQUE INDEX `uq_puzzle_schedule_date` (`date`), PRIMARY KEY (`id`), CONSTRAINT `fk_puzzle_schedule_puzzle` FOREIGN KEY (`puzzle_id`) REFERENCES `daily_puzzle`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `user_puzzle_solve` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `date` varchar(10) NOT NULL, `puzzle_id` int NOT NULL, `solved_at` datetime NOT NULL, UNIQUE INDEX `uq_user_puzzle_day` (`user_id`, `date`), PRIMARY KEY (`id`), CONSTRAINT `fk_puzzle_solve_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_puzzle_solve`');
    await queryRunner.query('DROP TABLE IF EXISTS `daily_puzzle_schedule`');
    await queryRunner.query('DROP TABLE IF EXISTS `daily_puzzle`');
  }
}
