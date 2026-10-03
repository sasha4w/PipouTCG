import { MigrationInterface, QueryRunner } from 'typeorm';

/** Scénarios du sandbox admin, partagés entre tous les admins. */
export class SandboxScenario1791000000002 implements MigrationInterface {
  name = 'SandboxScenario1791000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `sandbox_scenario` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`name` varchar(80) NOT NULL, ' +
        '`description` varchar(500) NULL DEFAULT NULL, ' +
        '`state` json NOT NULL, ' +
        '`created_by_id` int NOT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ' +
        'INDEX `idx_sandbox_scenario_created_by` (`created_by_id`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `sandbox_scenario` ADD CONSTRAINT `fk_sandbox_scenario_user` ' +
        'FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `sandbox_scenario`');
  }
}
