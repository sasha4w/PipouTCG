import { MigrationInterface, QueryRunner } from 'typeorm';

/** Récompense « carte précise » en farm, par adversaire d'aventure. */
export class AdventureFarmCard1791000000014 implements MigrationInterface {
  name = 'AdventureFarmCard1791000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` ADD `farm_card_id` int NULL DEFAULT NULL, ADD `farm_card_pct` decimal(5,2) NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` ADD CONSTRAINT `FK_adventure_opponent_farm_card` FOREIGN KEY (`farm_card_id`) REFERENCES `card`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` DROP FOREIGN KEY `FK_adventure_opponent_farm_card`',
    );
    await queryRunner.query(
      'ALTER TABLE `adventure_opponent` DROP COLUMN `farm_card_pct`, DROP COLUMN `farm_card_id`',
    );
  }
}
