import { fork } from 'node:child_process';
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { extname } from 'node:path';
import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';
import { parseNote } from './learned-eval';
import type { Note } from './learned-eval';
import { collectGame } from './selfplay-data';
import type { Sample } from './selfplay-data';
import { planGames } from './tournament';
import type { TournamentEntry } from './tournament';

/**
 * Positions étiquetées par auto-jeu, pour l'entraînement de la note.
 *
 *   pnpm --filter @pipou/backend ai:selfplay-data <sortie.jsonl>
 *     [--deck-seeds 95] [--first-deck-seed 101] [--games 2] [--seed 7]
 *     [--explore 0.1] [--note legacy|learned|fichier.json] [--workers N]
 *
 * Tous les decks jouent avec le planificateur le plus fort et la note donnée,
 * plus `--explore` de coups plausibles tirés au hasard. Le fichier est écrasé.
 * Les graines de decks commencent à 101 : 1 à 30 sont réservées aux contrôles.
 */
function raw(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string, fallback: number) =>
  raw(name) === undefined ? fallback : Number(raw(name));

interface Planned {
  g: number;
  p1: TournamentEntry;
  p2: TournamentEntry;
  seed: number;
}

/** Toutes les parties, dans un ordre qui ne dépend pas du nombre de processus. */
function plan(note: Note, explore: number): Planned[] {
  const cards = allRealCards();
  const first = num('first-deck-seed', 101);
  const out: Planned[] = [];
  for (let d = 0; d < num('deck-seeds', 95); d++) {
    const entries = buildGeneratedEntries(cards, first + d).map((e) => ({
      ...e,
      brain: 'plan' as const,
      note,
      mistakeRate: explore,
    }));
    const seed = num('seed', 7) + (first + d) * 1_000_003;
    for (const game of planGames(entries, num('games', 2), seed))
      out.push({
        g: out.length,
        p1: entries[game.p1],
        p2: entries[game.p2],
        seed: game.seed,
      });
  }
  return out;
}

const part = (out: string, shard: number) => `${out}.part${shard}`;

function runShard(out: string, shard: number, shards: number): void {
  const games = plan(
    parseNote(raw('note'), 'legacy'),
    num('explore', 0.1),
  ).filter((game) => game.g % shards === shard);
  writeFileSync(part(out, shard), '');
  for (const game of games) {
    const lines = collectGame(game.p1, game.p2, game.seed, game.g)
      .map((s) => JSON.stringify(s))
      .join('\n');
    if (lines) appendFileSync(part(out, shard), `${lines}\n`);
  }
}

function forkShard(shard: number, shards: number): Promise<void> {
  const ts = extname(__filename) === '.ts';
  const child = fork(
    __filename,
    [
      ...process.argv.slice(2),
      '--shard',
      String(shard),
      '--shards',
      String(shards),
    ],
    {
      execArgv: ts
        ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
        : [],
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  return new Promise((resolve, reject) =>
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Processus ${shard} arrêté (code ${code})`)),
    ),
  );
}

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out || out.startsWith('--'))
    throw new Error('Usage : ai:selfplay-data <sortie.jsonl> [options]');
  const shard = raw('shard');
  if (shard !== undefined) {
    runShard(out, Number(shard), num('shards', 1));
    return;
  }
  const workers = num('workers', Math.max(1, cpus().length - 2));
  const started = Date.now();
  console.log(`Auto-jeu sur ${workers} processus…`);
  await Promise.all(
    Array.from({ length: workers }, (_, i) => forkShard(i, workers)),
  );
  // Tri par partie : le fichier ne dépend pas du nombre de processus
  const lines: { g: number; line: string }[] = [];
  for (let i = 0; i < workers; i++) {
    for (const line of readFileSync(part(out, i), 'utf8').split('\n'))
      if (line) lines.push({ g: (JSON.parse(line) as Sample).g, line });
    rmSync(part(out, i));
  }
  lines.sort((x, y) => x.g - y.g);
  writeFileSync(out, lines.map((l) => l.line).join('\n') + '\n');
  const games = new Set(lines.map((l) => l.g)).size;
  console.log(
    `${lines.length} positions de ${games} parties en ${Math.round((Date.now() - started) / 1000)} s : ${out}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
