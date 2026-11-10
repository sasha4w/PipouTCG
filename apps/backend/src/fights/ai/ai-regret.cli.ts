import { readFileSync } from 'node:fs';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { evaluatorOf, parseNote } from './learned-eval';
import { regretOf } from './regret';
import type { BenchPosition } from './regret';

/**
 * Regret d'une note sur le banc de positions (`ai:rollout`).
 *
 *   pnpm --filter @pipou/backend ai:regret <banc.jsonl> [--note legacy|learned|fichier.json]
 *
 * Regret : taux de victoire du meilleur coup moins celui du coup préféré par
 * la note. Plus bas, mieux c'est.
 */
function main(argv: string[]): void {
  const file = argv[0];
  if (!file) throw new Error('Usage : ai:regret <banc.jsonl> [--note …]');
  const i = argv.indexOf('--note');
  const note = parseNote(i >= 0 ? argv[i + 1] : undefined, 'legacy');
  const evaluate = evaluatorOf(note);
  const engine = createEngine(fixedRng());
  const groups = new Map<string, { n: number; regret: number; best: number }>();
  const add = (key: string, regret: number, best: boolean) => {
    const g = groups.get(key) ?? { n: 0, regret: 0, best: 0 };
    g.n++;
    g.regret += regret;
    g.best += best ? 1 : 0;
    groups.set(key, g);
  };
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const pos = JSON.parse(line) as BenchPosition;
    const r = regretOf(engine, pos, evaluate);
    if (!r) continue;
    add('total', r.regret, r.best);
    add(pos.archetype, r.regret, r.best);
  }
  console.log('| Groupe | Positions | Regret moyen | Meilleur coup choisi |');
  console.log('|---|---|---|---|');
  for (const [key, g] of groups)
    console.log(
      `| ${key} | ${g.n} | ${((100 * g.regret) / g.n).toFixed(2)} points | ${((100 * g.best) / g.n).toFixed(1)} % |`,
    );
}

main(process.argv.slice(2));
