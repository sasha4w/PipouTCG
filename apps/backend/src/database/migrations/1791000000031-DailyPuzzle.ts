import { MigrationInterface, QueryRunner } from 'typeorm';
import { PuzzleScheduleOrigin, PuzzleStatus } from '@pipou/shared';
import { Card } from '../../cards/card.entity';
import { setEvolutionCatalog } from '../../fights/helpers/evolution-catalog';
import { buildPuzzle } from '../../puzzles/content/puzzle-builder';
import { PUZZLES } from '../../puzzles/content/puzzle-catalog';
import { addDays, puzzleDay } from '../../puzzles/puzzle-schedule';
import { serializeGame } from '../../sandbox/scenario-serializer';

/**
 * Défi du jour : défis, calendrier (un défi par jour) et résolutions par joueur,
 * puis les 28 premiers défis (catalogue `puzzles/content`), publiés et programmés
 * à raison d'un par jour à partir de demain.
 *
 * Les défis sont construits sur les cartes de la base, retrouvées par leur nom.
 * Un défi dont une carte manque est sauté (et signalé) au lieu de faire échouer
 * le déploiement : l'admin pourra le recréer depuis le sandbox. Le solveur n'est
 * pas lancé ici (il charge les cartes de test, absentes de l'image de prod) : le
 * catalogue est prouvé soluble par `puzzle-catalog.spec.ts`.
 */
export class DailyPuzzle1791000000031 implements MigrationInterface {
  name = 'DailyPuzzle1791000000031';

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
    await this.seedPuzzles(queryRunner);
  }

  /** Insère le catalogue (idempotent : la clé est le titre) puis le programme. */
  private async seedPuzzles(queryRunner: QueryRunner): Promise<void> {
    const cards = await queryRunner.manager.getRepository(Card).find();
    const byName = new Map(cards.map((c) => [c.name, c]));
    setEvolutionCatalog(cards);
    const lookup = (name: string): Card => {
      const card = byName.get(name);
      if (!card) throw new Error(`Carte « ${name} » absente de la base`);
      return card;
    };

    const from = addDays(puzzleDay(new Date()), 1);
    for (const [i, def] of PUZZLES.entries()) {
      const rows: { id: number }[] = await queryRunner.query(
        'SELECT `id` FROM `daily_puzzle` WHERE `title` = ?',
        [def.title],
      );
      if (rows.length > 0) continue;
      let built: ReturnType<typeof buildPuzzle>;
      try {
        built = buildPuzzle(def, lookup);
      } catch (e) {
        console.warn(
          `[DailyPuzzle] « ${def.title} » sauté : ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }
      const { type, ...params } = built.objective;
      const result: { insertId: number } = await queryRunner.query(
        'INSERT INTO `daily_puzzle` (`title`, `description`, `state`, `objective_type`, `objective_params`, `seed`, `status`, `verified_at`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          def.title,
          def.description,
          JSON.stringify(serializeGame(built.game)),
          type,
          JSON.stringify(params),
          def.seed,
          PuzzleStatus.PUBLISHED,
        ],
      );
      await queryRunner.query(
        'INSERT IGNORE INTO `daily_puzzle_schedule` (`date`, `puzzle_id`, `origin`) VALUES (?, ?, ?)',
        [addDays(from, i), result.insertId, PuzzleScheduleOrigin.MANUAL],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_puzzle_solve`');
    await queryRunner.query('DROP TABLE IF EXISTS `daily_puzzle_schedule`');
    await queryRunner.query('DROP TABLE IF EXISTS `daily_puzzle`');
  }
}
