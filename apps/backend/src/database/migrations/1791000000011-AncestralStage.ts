import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stade « ancestral » (Drakons Ancestraux) dans l'enum `card.stage`. */
export class AncestralStage1791000000011 implements MigrationInterface {
  name = 'AncestralStage1791000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `card` MODIFY `stage` enum ('egg', 'baby', 'young', 'adult', 'ancestral') NULL DEFAULT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `card` SET `stage` = 'adult' WHERE `stage` = 'ancestral'",
    );
    await queryRunner.query(
      "ALTER TABLE `card` MODIFY `stage` enum ('egg', 'baby', 'young', 'adult') NULL DEFAULT NULL",
    );
  }
}
