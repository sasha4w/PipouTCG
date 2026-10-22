import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { formatDetail, formatMirror, formatSummary } from './report';
import { SCALES, planJobs, planMirrorJobs, runJobs } from './tournament-jobs';
import type { ScaleName } from './tournament-jobs';

/** Lit `--nom <valeur>` dans argv. */
function raw(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function num(name: string, fallback: number): number {
  const v = raw(name);
  return v === undefined ? fallback : Number(v);
}

/**
 * Tournoi sur decks générés en code à graine fixe, sans base.
 * `--scale rapide|standard|complet`, ou une seule graine avec
 * `--deck-seed`, `--games` ; `--seed` (parties), `--workers`,
 * `--brain plan|greedy` (plan par défaut), `--mirror` (nouveau contre ancien).
 */
async function main(): Promise<void> {
  const scaleName = raw('scale') as ScaleName | undefined;
  if (scaleName && !(scaleName in SCALES))
    throw new Error(
      `Échelle inconnue « ${scaleName} » (${Object.keys(SCALES).join(', ')})`,
    );
  const scale = scaleName ? SCALES[scaleName] : undefined;
  const deckSeeds = scale
    ? Array.from({ length: scale.deckSeeds }, (_, i) => i + 1)
    : [num('deck-seed', 1)];
  const games = scale ? scale.games : num('games', 10);
  const seed = num('seed', 42);
  const workers = num('workers', Math.max(1, cpus().length - 2));
  const mirror = process.argv.includes('--mirror');
  const brain = raw('brain') ?? 'plan';
  if (brain !== 'plan' && brain !== 'greedy')
    throw new Error(`Cerveau inconnu « ${brain} » (plan, greedy)`);
  const label = `${mirror ? 'miroir-' : ''}${scaleName ?? `graine-decks-${deckSeeds[0]}`}${!mirror && brain === 'greedy' ? '-glouton' : ''}`;

  const jobs = mirror
    ? planMirrorJobs(deckSeeds, games, seed)
    : planJobs(deckSeeds, games, seed, brain);
  const total = jobs.reduce((n, j) => n + j.games.length, 0);
  console.log(
    `${label} : graines de decks ${deckSeeds[0]} à ${deckSeeds.at(-1)}, ${games} parties par paire, graine ${seed}, ${total} parties, ${workers} processus`,
  );
  const started = Date.now();
  let lastTenth = 0;
  const result = await runJobs(jobs, workers, undefined, (done, all) => {
    const tenth = Math.floor((10 * done) / all);
    if (tenth > lastTenth) {
      lastTenth = tenth;
      console.log(
        `  ${tenth * 10} % (${Math.round((Date.now() - started) / 1000)} s)`,
      );
    }
  });
  const seconds = Math.round((Date.now() - started) / 1000);

  const head = mirror ? formatMirror(result) : formatSummary(result, label);
  const summary = `${head}\n\nDurée : ${seconds} s.`;
  console.log(`\n${summary}`);

  const dir = join(__dirname, '..', '..', '..', '.e2e');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = join(dir, `tournament-${label}-${stamp}`);
  writeFileSync(`${base}-resume.md`, summary);
  writeFileSync(`${base}-detail.md`, formatDetail(result));
  writeFileSync(`${base}-detail.json`, JSON.stringify(result, null, 2));
  console.log(`\nFichiers : ${base}-{resume.md,detail.md,detail.json}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
