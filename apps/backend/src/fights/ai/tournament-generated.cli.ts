import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';
import { formatTournament, runTournament } from './tournament';

/** Lit `--nom <n>` dans argv, sinon la valeur par défaut. */
function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

/** Tournoi sur decks générés en code à graine fixe : aucune base requise. */
function main(): void {
  const deckSeed = arg('deck-seed', 1);
  const games = arg('games', 10);
  const seed = arg('seed', 42);

  const entries = buildGeneratedEntries(allRealCards(), deckSeed);
  const pairs = (entries.length * (entries.length - 1)) / 2;
  console.log(
    `${entries.length} decks (graine decks ${deckSeed}), ${pairs} paires, ${games} parties par paire, graine parties ${seed}`,
  );
  const result = runTournament(entries, games, seed);
  console.log(formatTournament(result));

  const dir = join(__dirname, '..', '..', '..', '.e2e');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `tournament-generated-${deckSeed}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`Résultats : ${file}`);
}

main();
