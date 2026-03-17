import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1773750346707 implements MigrationInterface {
    name = 'InitSchema1773750346707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`card_set\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`booster\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`card_number\` enum ('1', '5', '8', '10') NOT NULL, \`price\` int NOT NULL, \`card_set_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`booster_open_history\` (\`id\` int NOT NULL AUTO_INCREMENT, \`opened_at\` datetime NOT NULL, \`user_id\` int NULL, \`booster_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`booster_open_card\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL DEFAULT '1', \`card_id\` int NULL, \`open_history_id\` int NULL, UNIQUE INDEX \`IDX_819658fbe7e923abd8c1ff52f5\` (\`open_history_id\`, \`card_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`image\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`url\` varchar(255) NOT NULL, \`delete_url\` varchar(255) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`card\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`rarity\` enum ('common', 'uncommon', 'rare', 'epic', 'legendary', 'secret') NOT NULL, \`type\` enum ('monster', 'support') NOT NULL, \`atk\` int NOT NULL DEFAULT '0', \`hp\` int NOT NULL DEFAULT '0', \`cost\` int NOT NULL DEFAULT '0', \`support_type\` enum ('EPHEMERAL', 'EQUIPMENT', 'TERRAIN') NULL, \`archetype\` enum ('pipou', 'dragon', 'pixelman') NULL, \`effects\` json NULL, \`description\` varchar(255) NULL, \`image_id\` int NULL, \`card_set_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_card\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL DEFAULT '1', \`user_id\` int NULL, \`card_id\` int NULL, UNIQUE INDEX \`IDX_549eb4a507d092d4d3cfef79b2\` (\`user_id\`, \`card_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_booster\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL DEFAULT '1', \`user_id\` int NULL, \`booster_id\` int NULL, UNIQUE INDEX \`IDX_c139b9cdc9e4f407562c125c2f\` (\`user_id\`, \`booster_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`bundle_content\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL DEFAULT '1', \`bundle_id\` int NULL, \`card_id\` int NULL, \`booster_id\` int NULL, INDEX \`IDX_9103b577263298fcedf8b4755f\` (\`bundle_id\`, \`booster_id\`), INDEX \`IDX_95ff5162bb15f8f5df36b61c89\` (\`bundle_id\`, \`card_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`bundle\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`price\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_bundle\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL DEFAULT '1', \`user_id\` int NULL, \`bundle_id\` int NULL, UNIQUE INDEX \`IDX_bc60a24bd8f66e89378c7a295c\` (\`user_id\`, \`bundle_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quest\` (\`id\` int NOT NULL AUTO_INCREMENT, \`title\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`reset_type\` enum ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'EVENT') NOT NULL DEFAULT 'NONE', \`reset_hour\` int NOT NULL DEFAULT '4', \`reset_day_of_week\` int NULL, \`condition_group\` json NOT NULL, \`reward_type\` enum ('GOLD', 'BOOSTER', 'BUNDLE') NOT NULL, \`reward_amount\` bigint NOT NULL DEFAULT '0', \`reward_item_id\` int NULL, \`end_date\` timestamp NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_quest\` (\`id\` int NOT NULL AUTO_INCREMENT, \`progress\` json NOT NULL, \`is_completed\` tinyint NOT NULL DEFAULT 0, \`reward_claimed\` tinyint NOT NULL DEFAULT 0, \`assigned_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`completed_at\` datetime NULL, \`reset_at\` datetime NULL, \`user_id\` int NULL, \`quest_id\` int NULL, UNIQUE INDEX \`IDX_496f4d1d8d3414efe2724e0833\` (\`user_id\`, \`quest_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`transaction\` (\`id\` int NOT NULL AUTO_INCREMENT, \`product_type\` enum ('CARD', 'BOOSTER', 'BUNDLE') NOT NULL, \`product_id\` int NOT NULL, \`quantity\` int NOT NULL, \`unit_price\` bigint NOT NULL, \`total_price\` bigint NOT NULL, \`status\` enum ('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`buyer_id\` int NULL, \`seller_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`username\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`is_admin\` tinyint NOT NULL DEFAULT 0, \`reset_token_hash\` varchar(64) NULL, \`reset_token_expiry\` timestamp NULL, \`is_private\` tinyint NOT NULL DEFAULT 0, \`gold\` bigint NOT NULL DEFAULT '0', \`money_spent\` bigint NOT NULL DEFAULT '0', \`money_earned\` bigint NOT NULL DEFAULT '0', \`cards_bought\` int NOT NULL DEFAULT '0', \`boosters_bought\` int NOT NULL DEFAULT '0', \`bundles_bought\` int NOT NULL DEFAULT '0', \`cards_sold\` int NOT NULL DEFAULT '0', \`boosters_sold\` int NOT NULL DEFAULT '0', \`bundles_sold\` int NOT NULL DEFAULT '0', \`experience\` int NOT NULL DEFAULT '0', \`boosters_opened\` int NOT NULL DEFAULT '0', \`sets_completed\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_78a916df40e02a9deb1c4b75ed\` (\`username\`), UNIQUE INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`booster\` ADD CONSTRAINT \`FK_4c00eb0f86a4fd6a427eb9f2d5e\` FOREIGN KEY (\`card_set_id\`) REFERENCES \`card_set\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`booster_open_history\` ADD CONSTRAINT \`FK_8668e06d5aed4909992a9d5d514\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`booster_open_history\` ADD CONSTRAINT \`FK_12f06892448f89fc150425675a9\` FOREIGN KEY (\`booster_id\`) REFERENCES \`booster\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`booster_open_card\` ADD CONSTRAINT \`FK_4c1f614b493778202d222ff1df9\` FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`booster_open_card\` ADD CONSTRAINT \`FK_541354ab53f35188148feb88eed\` FOREIGN KEY (\`open_history_id\`) REFERENCES \`booster_open_history\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`card\` ADD CONSTRAINT \`FK_4b51f4fd1c988cfefd4ee4d70f7\` FOREIGN KEY (\`image_id\`) REFERENCES \`image\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`card\` ADD CONSTRAINT \`FK_3a6cdccc7bb2189fd8af97ac971\` FOREIGN KEY (\`card_set_id\`) REFERENCES \`card_set\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_card\` ADD CONSTRAINT \`FK_d7fa5bc81ffc9708abd2d210c4a\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_card\` ADD CONSTRAINT \`FK_2d154950ea2aae6f33f2dcdf8e1\` FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_booster\` ADD CONSTRAINT \`FK_51decd917fe468bf352f738a294\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_booster\` ADD CONSTRAINT \`FK_67885bfa7a588638bd79ec13227\` FOREIGN KEY (\`booster_id\`) REFERENCES \`booster\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` ADD CONSTRAINT \`FK_4054ae19149b3d8b4ac2812509e\` FOREIGN KEY (\`bundle_id\`) REFERENCES \`bundle\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` ADD CONSTRAINT \`FK_f01185b4da4b5990cdb86552891\` FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` ADD CONSTRAINT \`FK_19083754a8097051f14857a8068\` FOREIGN KEY (\`booster_id\`) REFERENCES \`booster\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_bundle\` ADD CONSTRAINT \`FK_ee7a9293c2e447c16c8d5f3bf44\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_bundle\` ADD CONSTRAINT \`FK_3f2716b73c7c1069a7749cb5ab4\` FOREIGN KEY (\`bundle_id\`) REFERENCES \`bundle\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_quest\` ADD CONSTRAINT \`FK_9edd92a2287c93b164656e1d97f\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_quest\` ADD CONSTRAINT \`FK_a96235c755bbc9b487ca95f63fd\` FOREIGN KEY (\`quest_id\`) REFERENCES \`quest\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transaction\` ADD CONSTRAINT \`FK_acda004564ac94b2a70c8e70a6c\` FOREIGN KEY (\`buyer_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transaction\` ADD CONSTRAINT \`FK_d039bb371ba27911447b75f07d8\` FOREIGN KEY (\`seller_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`transaction\` DROP FOREIGN KEY \`FK_d039bb371ba27911447b75f07d8\``);
        await queryRunner.query(`ALTER TABLE \`transaction\` DROP FOREIGN KEY \`FK_acda004564ac94b2a70c8e70a6c\``);
        await queryRunner.query(`ALTER TABLE \`user_quest\` DROP FOREIGN KEY \`FK_a96235c755bbc9b487ca95f63fd\``);
        await queryRunner.query(`ALTER TABLE \`user_quest\` DROP FOREIGN KEY \`FK_9edd92a2287c93b164656e1d97f\``);
        await queryRunner.query(`ALTER TABLE \`user_bundle\` DROP FOREIGN KEY \`FK_3f2716b73c7c1069a7749cb5ab4\``);
        await queryRunner.query(`ALTER TABLE \`user_bundle\` DROP FOREIGN KEY \`FK_ee7a9293c2e447c16c8d5f3bf44\``);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` DROP FOREIGN KEY \`FK_19083754a8097051f14857a8068\``);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` DROP FOREIGN KEY \`FK_f01185b4da4b5990cdb86552891\``);
        await queryRunner.query(`ALTER TABLE \`bundle_content\` DROP FOREIGN KEY \`FK_4054ae19149b3d8b4ac2812509e\``);
        await queryRunner.query(`ALTER TABLE \`user_booster\` DROP FOREIGN KEY \`FK_67885bfa7a588638bd79ec13227\``);
        await queryRunner.query(`ALTER TABLE \`user_booster\` DROP FOREIGN KEY \`FK_51decd917fe468bf352f738a294\``);
        await queryRunner.query(`ALTER TABLE \`user_card\` DROP FOREIGN KEY \`FK_2d154950ea2aae6f33f2dcdf8e1\``);
        await queryRunner.query(`ALTER TABLE \`user_card\` DROP FOREIGN KEY \`FK_d7fa5bc81ffc9708abd2d210c4a\``);
        await queryRunner.query(`ALTER TABLE \`card\` DROP FOREIGN KEY \`FK_3a6cdccc7bb2189fd8af97ac971\``);
        await queryRunner.query(`ALTER TABLE \`card\` DROP FOREIGN KEY \`FK_4b51f4fd1c988cfefd4ee4d70f7\``);
        await queryRunner.query(`ALTER TABLE \`booster_open_card\` DROP FOREIGN KEY \`FK_541354ab53f35188148feb88eed\``);
        await queryRunner.query(`ALTER TABLE \`booster_open_card\` DROP FOREIGN KEY \`FK_4c1f614b493778202d222ff1df9\``);
        await queryRunner.query(`ALTER TABLE \`booster_open_history\` DROP FOREIGN KEY \`FK_12f06892448f89fc150425675a9\``);
        await queryRunner.query(`ALTER TABLE \`booster_open_history\` DROP FOREIGN KEY \`FK_8668e06d5aed4909992a9d5d514\``);
        await queryRunner.query(`ALTER TABLE \`booster\` DROP FOREIGN KEY \`FK_4c00eb0f86a4fd6a427eb9f2d5e\``);
        await queryRunner.query(`DROP INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` ON \`user\``);
        await queryRunner.query(`DROP INDEX \`IDX_78a916df40e02a9deb1c4b75ed\` ON \`user\``);
        await queryRunner.query(`DROP TABLE \`user\``);
        await queryRunner.query(`DROP TABLE \`transaction\``);
        await queryRunner.query(`DROP INDEX \`IDX_496f4d1d8d3414efe2724e0833\` ON \`user_quest\``);
        await queryRunner.query(`DROP TABLE \`user_quest\``);
        await queryRunner.query(`DROP TABLE \`quest\``);
        await queryRunner.query(`DROP INDEX \`IDX_bc60a24bd8f66e89378c7a295c\` ON \`user_bundle\``);
        await queryRunner.query(`DROP TABLE \`user_bundle\``);
        await queryRunner.query(`DROP TABLE \`bundle\``);
        await queryRunner.query(`DROP INDEX \`IDX_95ff5162bb15f8f5df36b61c89\` ON \`bundle_content\``);
        await queryRunner.query(`DROP INDEX \`IDX_9103b577263298fcedf8b4755f\` ON \`bundle_content\``);
        await queryRunner.query(`DROP TABLE \`bundle_content\``);
        await queryRunner.query(`DROP INDEX \`IDX_c139b9cdc9e4f407562c125c2f\` ON \`user_booster\``);
        await queryRunner.query(`DROP TABLE \`user_booster\``);
        await queryRunner.query(`DROP INDEX \`IDX_549eb4a507d092d4d3cfef79b2\` ON \`user_card\``);
        await queryRunner.query(`DROP TABLE \`user_card\``);
        await queryRunner.query(`DROP TABLE \`card\``);
        await queryRunner.query(`DROP TABLE \`image\``);
        await queryRunner.query(`DROP INDEX \`IDX_819658fbe7e923abd8c1ff52f5\` ON \`booster_open_card\``);
        await queryRunner.query(`DROP TABLE \`booster_open_card\``);
        await queryRunner.query(`DROP TABLE \`booster_open_history\``);
        await queryRunner.query(`DROP TABLE \`booster\``);
        await queryRunner.query(`DROP TABLE \`card_set\``);
    }

}
