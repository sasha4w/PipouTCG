import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { extname, join } from 'node:path';
import type { Card } from '../../cards/card.entity';
import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';
import { mergeResults, planGames, playPlanned } from './tournament';
import type {
  PlannedGame,
  TournamentEntry,
  TournamentResult,
} from './tournament';

export type ScaleName = 'rapide' | 'standard' | 'complet';

/** Graines de decks (1 à N) et parties par paire de chaque échelle. */
export const SCALES: Record<ScaleName, { deckSeeds: number; games: number }> = {
  rapide: { deckSeeds: 3, games: 4 },
  standard: { deckSeeds: 10, games: 10 },
  complet: { deckSeeds: 30, games: 20 },
};

/** Parties d'une paire, pour une graine de decks. */
export interface Job {
  deckSeed: number;
  games: PlannedGame[];
}

let cards: Card[] | undefined;
const entriesBySeed = new Map<number, TournamentEntry[]>();

/** Les 15 decks générés d'une graine (mis en cache dans le processus). */
function entriesFor(deckSeed: number): TournamentEntry[] {
  let entries = entriesBySeed.get(deckSeed);
  if (!entries) {
    cards ??= allRealCards();
    entries = buildGeneratedEntries(cards, deckSeed);
    entriesBySeed.set(deckSeed, entries);
  }
  return entries;
}

/**
 * Un job par graine de decks et par paire. Les graines des parties sont
 * celles du tournoi complet de chaque graine de decks : le découpage ne
 * change pas les parties jouées.
 */
export function planJobs(
  deckSeeds: number[],
  gamesPerPair: number,
  seed: number,
): Job[] {
  const jobs: Job[] = [];
  for (const deckSeed of deckSeeds) {
    const byPair = new Map<string, PlannedGame[]>();
    for (const g of planGames(entriesFor(deckSeed), gamesPerPair, seed)) {
      const key = `${g.i}-${g.j}`;
      byPair.set(key, [...(byPair.get(key) ?? []), g]);
    }
    for (const games of byPair.values()) jobs.push({ deckSeed, games });
  }
  return jobs;
}

export function runJob(job: Job): TournamentResult {
  return playPlanned(entriesFor(job.deckSeed), job.games);
}

/**
 * Exécute les jobs par `workers` à la fois et fusionne les résultats dans
 * l'ordre des jobs (même résultat quel que soit `workers`). `exec` par
 * défaut : des processus enfants (`tournament-worker`).
 */
export async function runJobs(
  jobs: Job[],
  workers: number,
  exec?: (job: Job) => Promise<TournamentResult>,
  onProgress?: (done: number, total: number) => void,
): Promise<TournamentResult> {
  if (jobs.length === 0) throw new Error('Aucun job à exécuter');
  const pool = exec ? null : processPool(Math.max(1, workers));
  const run = exec ?? pool!.exec;
  const results = new Array<TournamentResult>(jobs.length);
  let next = 0;
  let done = 0;
  const lane = async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await run(jobs[index]);
      onProgress?.(++done, jobs.length);
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(Math.max(1, workers), jobs.length) }, lane),
    );
  } finally {
    pool?.close();
  }
  return results.reduce(mergeResults);
}

/** Processus enfants qui jouent chacun un job à la fois. */
function processPool(size: number): {
  exec: (job: Job) => Promise<TournamentResult>;
  close: () => void;
} {
  const ext = extname(__filename);
  const script = join(__dirname, `tournament-worker${ext}`);
  const execArgv =
    ext === '.ts'
      ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
      : [];
  const idle: ChildProcess[] = Array.from({ length: size }, () =>
    fork(script, [], {
      execArgv,
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    }),
  );
  const waiting: ((child: ChildProcess) => void)[] = [];
  const all = [...idle];
  const acquire = () =>
    new Promise<ChildProcess>((resolve) => {
      const child = idle.pop();
      if (child) resolve(child);
      else waiting.push(resolve);
    });
  const release = (child: ChildProcess) => {
    const w = waiting.shift();
    if (w) w(child);
    else idle.push(child);
  };
  return {
    exec: async (job) => {
      const child = await acquire();
      try {
        return await new Promise<TournamentResult>((resolve, reject) => {
          const onExit = (code: number | null) =>
            reject(new Error(`Processus de tournoi arrêté (code ${code})`));
          child.once('exit', onExit);
          child.once('message', (msg) => {
            child.off('exit', onExit);
            resolve(msg as TournamentResult);
          });
          child.send(job);
        });
      } finally {
        release(child);
      }
    },
    close: () => all.forEach((c) => c.kill()),
  };
}
