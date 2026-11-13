import 'reflect-metadata';
import './seed-env';
import { PuzzleScheduleOrigin, PuzzleStatus } from '@pipou/shared';
import { Card } from '../../cards/card.entity';
import { setEvolutionCatalog } from '../../fights/helpers/evolution-catalog';
import dataSource from '../../database/data-source';
import { createEngine } from '../../fights/testing/engine';
import { serializeGame } from '../../sandbox/scenario-serializer';
import { DailyPuzzle } from '../daily-puzzle.entity';
import { DailyPuzzleSchedule } from '../daily-puzzle-schedule.entity';
import { addDays, puzzleDay } from '../puzzle-schedule';
import { solvePuzzle } from '../puzzle-solver';
import { buildPuzzle } from './puzzle-builder';
import { PUZZLES } from './puzzle-catalog';

/**
 * Insère le catalogue de défis dans la base (idempotent : la clé est le titre).
 *
 *   ENV_FILE=.env.dev.local pnpm --filter @pipou/backend seed:puzzles
 *     [--schedule] [--schedule-from YYYY-MM-DD] [--allow-remote]
 *
 * Chaque défi est résolu par le vrai solveur sur les cartes de la base avant
 * insertion : il est inséré publié et vérifié, ou pas du tout. `--schedule`
 * programme les défis dans l'ordre du catalogue, un par jour, à partir de demain
 * (ou de `--schedule-from`), sur les jours encore libres.
 * Refuse une base non locale sans `--allow-remote`.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? '';
  if (!LOCAL_HOSTS.has(host) && !flag('allow-remote'))
    throw new Error(
      `Base « ${host} » non locale : refus. Passe --allow-remote pour l'écrire quand même.`,
    );

  await dataSource.initialize();
  try {
    const cards = await dataSource.getRepository(Card).find();
    const byName = new Map(cards.map((c) => [c.name, c]));
    setEvolutionCatalog(cards);
    const engine = createEngine();
    // createEngine() charge les cartes de test : on remet celles de la base.
    setEvolutionCatalog(cards);
    const lookup = (name: string): Card => {
      const card = byName.get(name);
      if (!card) throw new Error(`Carte « ${name} » absente de la base`);
      return card;
    };

    const repo = dataSource.getRepository(DailyPuzzle);
    const planning = dataSource.getRepository(DailyPuzzleSchedule);
    const ids: number[] = [];
    for (const def of PUZZLES) {
      const existing = await repo.findOneBy({ title: def.title });
      if (existing) {
        console.log(`= ${def.title} (déjà là, #${existing.id})`);
        ids.push(existing.id);
        continue;
      }
      const { game, objective } = buildPuzzle(def, lookup);
      const result = await solvePuzzle(engine, game, objective, def.seed, {
        maxNodes: 200_000,
        maxMs: 30_000,
      });
      if (result.status !== 'solved')
        throw new Error(`« ${def.title} » : solveur ${result.status}`);
      const { type, ...params } = objective;
      const saved = await repo.save(
        repo.create({
          title: def.title,
          description: def.description,
          state: serializeGame(game),
          objectiveType: type,
          objectiveParams: params,
          seed: def.seed,
          status: PuzzleStatus.PUBLISHED,
          verifiedAt: new Date(),
          createdBy: null,
        }),
      );
      ids.push(saved.id);
      console.log(
        `+ ${def.title} (#${saved.id}, ${result.solution.length} actions, ${Math.round(result.ms)} ms)`,
      );
    }

    if (flag('schedule')) {
      const from = option('schedule-from') ?? addDays(puzzleDay(new Date()), 1);
      let placed = 0;
      for (const [i, id] of ids.entries()) {
        const date = addDays(from, i);
        if (await planning.existsBy({ date })) {
          console.log(`  ${date} déjà programmé : sauté`);
          continue;
        }
        await planning.insert({
          date,
          puzzleId: id,
          origin: PuzzleScheduleOrigin.MANUAL,
        });
        placed++;
      }
      console.log(`${placed} jours programmés à partir du ${from}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
