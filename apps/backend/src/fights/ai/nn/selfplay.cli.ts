import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { allRealCards } from '../../testing/real-cards';
import { parseNote } from '../note';
import { collectGame, planSelfplay, selfplayMeta } from './selfplay';
import { arg, forkShards, num } from './shards';

/**
 * Parties d'auto-jeu pour l'entraînement du réseau.
 *
 *   pnpm --filter @pipou/backend ai:selfplay <dossier> --games 1500
 *     [--seed 1] [--note legacy|nn|poids.json] [--budget 2000]
 *     [--temperature 50] [--explore-decisions 8] [--workers N]
 *
 * Écrit part-<k>.jsonl.gz par processus, meta.json, puis done.json en dernier.
 */
function options() {
  return {
    games: num('games', 100),
    seed: num('seed', 1),
    note: parseNote(arg('note'), 'legacy'),
    budget: num('budget', 2000),
    temperature: num('temperature', 50),
    exploreDecisions: num('explore-decisions', 8),
  };
}

function runShard(dir: string, shard: number, shards: number): void {
  const games = planSelfplay(allRealCards(), options()).filter(
    (g) => g.g % shards === shard,
  );
  const lines: string[] = [];
  for (const game of games)
    for (const s of collectGame(game)) lines.push(JSON.stringify(s));
  writeFileSync(
    join(dir, `part-${shard}.jsonl.gz`),
    gzipSync(lines.length ? `${lines.join('\n')}\n` : ''),
  );
  writeFileSync(
    join(dir, `part-${shard}.json`),
    JSON.stringify({ games: games.length, positions: lines.length }),
  );
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw || raw.startsWith('--'))
    throw new Error('Usage : ai:selfplay <dossier> [options]');
  const dir = resolve(raw);
  const shard = arg('shard');
  if (shard !== undefined) {
    runShard(dir, Number(shard), num('shards', 1));
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify(selfplayMeta(allRealCards())),
  );
  const workers = num('workers', Math.max(1, cpus().length - 1));
  const started = Date.now();
  await forkShards(__filename, [dir, ...process.argv.slice(3)], workers);
  let games = 0;
  let positions = 0;
  for (let k = 0; k < workers; k++) {
    const part = JSON.parse(
      readFileSync(join(dir, `part-${k}.json`), 'utf8'),
    ) as { games: number; positions: number };
    games += part.games;
    positions += part.positions;
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  writeFileSync(
    join(dir, 'done.json'),
    JSON.stringify({ games, positions, seconds }),
  );
  console.log(
    `${positions} positions de ${games} parties en ${seconds} s : ${dir}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
