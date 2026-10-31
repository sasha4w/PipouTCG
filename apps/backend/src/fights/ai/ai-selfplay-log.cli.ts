import { writeFileSync } from 'node:fs';
import { allRealCards } from '../testing/real-cards';
import { fileSink } from './decision-log';
import { buildGeneratedEntries } from './generated-entries';
import { MAX_ACTIONS, playGame } from './tournament';
import type { Brain } from './tournament';

/**
 * Parties IA contre IA avec journal des décisions, à relire avec `ai:review`.
 *
 *   pnpm --filter @pipou/backend ai:selfplay-log <journal.jsonl> \
 *       [--a "pipou niveau 3"] [--b "dragon niveau 3"] [--games 2] [--seed 1] [--brain level|greedy|plan]
 *
 * La partie k joue avec la graine `seed + k` et les sièges alternent.
 * Le fichier est écrasé.
 */
function flags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined)
      throw new Error(`argument inattendu : ${args[i]}`);
    out[args[i].slice(2)] = args[i + 1];
  }
  return out;
}

function main(argv: string[]): void {
  const [out, ...rest] = argv;
  if (!out)
    throw new Error('usage : ai:selfplay-log <journal.jsonl> [options]');
  const f = flags(rest);
  const games = Number(f.games ?? 2);
  const seed = Number(f.seed ?? 1);
  const entries = buildGeneratedEntries(allRealCards(), 1);
  const pick = (name: string) => {
    const e = entries.find((x) => x.name === name);
    if (!e)
      throw new Error(
        `deck inconnu : ${name} (ex. ${entries.map((x) => x.name).join(', ')})`,
      );
    return e;
  };
  // Cerveau du niveau, comme en aventure (sans brain, le tournoi joue glouton)
  const brain = (f.brain ?? 'level') as Brain;
  const a = { ...pick(f.a ?? 'pipou niveau 3'), brain };
  const b = { ...pick(f.b ?? 'dragon niveau 3'), brain };

  writeFileSync(out, '');
  const sink = fileSink(out);
  for (let k = 0; k < games; k++) {
    const [p1, p2] = k % 2 === 0 ? [a, b] : [b, a];
    const { winner } = playGame(p1, p2, seed + k, MAX_ACTIONS, sink);
    const name = winner === null ? 'aucun' : [p1, p2][winner].name;
    console.log(
      `partie ${k + 1} (graine ${seed + k}) : ${p1.name} vs ${p2.name} → ${name}`,
    );
  }
  console.log(`Journal : ${out}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
