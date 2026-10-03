import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ajoute la fin de match « double_ko » (match nul). */
export class MatchDoubleKo1791000000000 implements MigrationInterface {
  name = 'MatchDoubleKo1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `match` MODIFY `end_reason` enum('primes_depleted','deck_empty','surrender','disconnect','double_ko') NULL DEFAULT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `match` SET `end_reason` = NULL WHERE `end_reason` = 'double_ko'",
    );
    await queryRunner.query(
      "ALTER TABLE `match` MODIFY `end_reason` enum('primes_depleted','deck_empty','surrender','disconnect') NULL DEFAULT NULL",
    );
  }
}
