import { MigrationInterface, QueryRunner } from 'typeorm';

/** Boîte de réception : messages par joueur, patchnotes et leur état « lu ». */
export class Notifications1791000000003 implements MigrationInterface {
  name = 'Notifications1791000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `notification` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`user_id` int NOT NULL, ' +
        '`type` varchar(32) NOT NULL, ' +
        '`payload` json NOT NULL, ' +
        '`ref_id` int NULL DEFAULT NULL, ' +
        '`read_at` datetime NULL DEFAULT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'INDEX `idx_notification_user_created` (`user_id`, `created_at`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `notification` ADD CONSTRAINT `fk_notification_user` ' +
        'FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'CREATE TABLE `patchnote` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`title` varchar(120) NOT NULL, ' +
        '`body` text NOT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `patchnote_read` (' +
        '`user_id` int NOT NULL, ' +
        '`patchnote_id` int NOT NULL, ' +
        '`read_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`user_id`, `patchnote_id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `patchnote_read` ADD CONSTRAINT `fk_patchnote_read_user` ' +
        'FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `patchnote_read` ADD CONSTRAINT `fk_patchnote_read_patchnote` ' +
        'FOREIGN KEY (`patchnote_id`) REFERENCES `patchnote`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `patchnote_read`');
    await queryRunner.query('DROP TABLE `patchnote`');
    await queryRunner.query('DROP TABLE `notification`');
  }
}
