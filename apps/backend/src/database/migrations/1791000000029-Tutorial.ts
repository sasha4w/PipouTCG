import { MigrationInterface, QueryRunner } from 'typeorm';

/** Leçons du tutoriel terminées : une ligne par joueur et par leçon (récompense unique). */
export class Tutorial1791000000029 implements MigrationInterface {
  name = 'Tutorial1791000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `user_tutorial_lesson` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `lesson_id` varchar(32) NOT NULL, `completed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_user_tutorial_lesson` (`user_id`, `lesson_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_user_tutorial_lesson_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_tutorial_lesson`');
  }
}
