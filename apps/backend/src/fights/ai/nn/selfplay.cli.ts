import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`--${name} doit être un nombre fini > 0 (reçu ${value})`);
  return value;
}

function options() {
  return {
    games: positive('games', num('games', 100)),
    seed: num('seed', 1),
    note: parseNote(arg('note'), 'legacy'),
    budget: positive('budget', num('budget', 2000)),
    temperature: num('temperature', 50),
    exploreDecisions: num('explore-decisions', 8),
  };
}

/** Écriture atomique : un lecteur voit l'ancien fichier ou le nouveau, jamais un demi-fichier. */
function writeAtomic(path: string, data: string | Buffer): void {
  writeFileSync(`${path}.tmp`, data);
  renameSync(`${path}.tmp`, path);
}

function runShard(dir: string, shard: number, shards: number): void {
  const games = planSelfplay(allRealCards(), options()).filter(
    (g) => g.g % shards === shard,
  );
  const lines: string[] = [];
  for (const game of games)
    for (const s of collectGame(game)) lines.push(JSON.stringify(s));
  // Le .gz d'abord, son .json ensuite : un .json présent garantit un .gz complet
  writeAtomic(
    join(dir, `part-${shard}.jsonl.gz`),
    gzipSync(lines.length ? `${lines.join('\n')}\n` : ''),
  );
  writeAtomic(
    join(dir, `part-${shard}.json`),
    JSON.stringify({ games: games.length, positions: lines.length }),
  );
}

/** Supprime les part-k.* de k >= workers, restes d'un run précédent plus large. */
function purgeStaleParts(dir: string, workers: number): void {
  for (const name of readdirSync(dir)) {
    const m = /^part-(\d+)\.(?:json|jsonl\.gz)(?:\.tmp)?$/.exec(name);
    if (m && Number(m[1]) >= workers) rmSync(join(dir, name));
  }
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
  const opts = options();
  const workers = positive(
    'workers',
    num('workers', Math.max(1, cpus().length - 1)),
  );
  mkdirSync(dir, { recursive: true });
  // Un dossier sans done.json est un run en cours ou interrompu
  rmSync(join(dir, 'done.json'), { force: true });
  purgeStaleParts(dir, workers);
  writeAtomic(
    join(dir, 'meta.json'),
    JSON.stringify({
      ...selfplayMeta(allRealCards()),
      seed: opts.seed,
      note: arg('note') ?? 'legacy',
      budget: opts.budget,
    }),
  );
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
  writeAtomic(
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
