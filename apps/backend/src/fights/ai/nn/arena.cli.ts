import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { allRealCards } from '../../testing/real-cards';
import { parseSide, planArena, playPair, verdict } from './arena';
import type { ArenaSettings, Outcome } from './arena';
import { arg, forkShards, num } from './shards';

/**
 * Challenger contre champion, decks miroirs.
 *
 *   pnpm --filter @pipou/backend ai:arena --challenger poids.json --champion legacy
 *     [--games 400] [--seed 1] [--budget 2000] [--time-ms 200] [--workers N] [--json sortie.json]
 *
 * Un côté : legacy, nn, un fichier de poids .json, ou level:1 à level:5.
 */
function positiveInt(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`--${name} doit être un entier > 0 (reçu ${value})`);
  return value;
}

function settings(): ArenaSettings {
  const challenger = arg('challenger');
  const champion = arg('champion');
  if (!challenger || !champion)
    throw new Error(
      'Usage : ai:arena --challenger <côté> --champion <côté> [options]',
    );
  const time = arg('time-ms');
  return {
    challenger: parseSide(challenger),
    champion: parseSide(champion),
    budget: positiveInt('budget', num('budget', 2000)),
    ...(time !== undefined && { timeMs: positiveInt('time-ms', Number(time)) }),
  };
}

function pairs() {
  const games = positiveInt('games', num('games', 400));
  return planArena(Math.ceil(games / 2), positiveInt('seed', num('seed', 1)));
}

/** Écriture atomique : un lecteur voit l'ancien fichier ou le nouveau, jamais un demi-fichier. */
function writeAtomic(path: string, data: string): void {
  writeFileSync(`${path}.tmp`, data);
  renameSync(`${path}.tmp`, path);
}

function runShard(out: string, shard: number, shards: number): void {
  const s = settings();
  const cards = allRealCards();
  const lines: string[] = [];
  for (const pair of pairs().filter((p) => p.k % shards === shard))
    lines.push(JSON.stringify(playPair(cards, pair, s)));
  writeAtomic(
    `${out}.part${shard}`,
    lines.length ? `${lines.join('\n')}\n` : '',
  );
}

/** Supprime les restes `<sortie>.part*` d'un run précédent. */
function purgeParts(out: string): void {
  const prefix = `${basename(out)}.part`;
  for (const name of readdirSync(dirname(out)))
    if (name.startsWith(prefix)) rmSync(join(dirname(out), name));
}

async function main(): Promise<void> {
  const out = resolve(
    arg('json') ?? join(tmpdir(), `arena-${Date.now()}.json`),
  );
  const shard = arg('shard');
  if (shard !== undefined) {
    runShard(out, Number(shard), positiveInt('shards', num('shards', 1)));
    return;
  }
  settings(); // erreurs d'arguments avant de lancer les processus
  const total = pairs().length;
  const workers = Math.min(
    positiveInt('workers', num('workers', Math.max(1, cpus().length - 1))),
    total,
  );
  mkdirSync(dirname(out), { recursive: true });
  purgeParts(out);
  const args = process.argv
    .slice(2)
    .filter((_, k, all) => all[k] !== '--json' && all[k - 1] !== '--json');
  await forkShards(__filename, [...args, '--json', out], workers);
  const outcomes: Outcome[] = [];
  for (let k = 0; k < workers; k++) {
    for (const line of readFileSync(`${out}.part${k}`, 'utf8').split('\n'))
      if (line) outcomes.push(...(JSON.parse(line) as Outcome[]));
    rmSync(`${out}.part${k}`);
  }
  const v = verdict(outcomes);
  writeAtomic(out, JSON.stringify(v, null, 2));
  console.log(
    `Arène : ${(v.score * 100).toFixed(1)} % sur ${v.games} parties (${v.wins} V, ${v.losses} D, ${v.draws} N), Wilson [${(v.lower * 100).toFixed(1)} ; ${(v.upper * 100).toFixed(1)}] : ${out}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
