import { MigrationInterface, QueryRunner } from 'typeorm';

/** Parties enregistrées : résumé pour la méta, trace pour l'apprentissage de l'IA. */
export class GameRecord1791000000028 implements MigrationInterface {
  name = 'GameRecord1791000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `game_record` (`id` int NOT NULL AUTO_INCREMENT, `match_id` int NOT NULL, `mode` varchar(8) NOT NULL, `player1_id` int NOT NULL, `player2_id` int NULL, `winner_seat` varchar(4) NULL, `end_reason` varchar(32) NULL, `turns` int NOT NULL, `moves` int NOT NULL, `summary` json NOT NULL, `trace` longblob NULL, `trace_bytes` int NOT NULL, `format_version` smallint NOT NULL, `started_at` datetime NOT NULL, `ended_at` datetime NOT NULL, INDEX `idx_game_record_mode` (`mode`), INDEX `idx_game_record_ended` (`ended_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `game_record`');
  }
}
