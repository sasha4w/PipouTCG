import { readDecisions } from './decision-log';
import { describeAction } from './ai-review';
import { evaluatorOf, parseNote } from './learned-eval';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';

/**
 * Explique une décision journalisée : rejoue chaque coup candidat sur l'état
 * enregistré (vrai moteur) et affiche l'écart de chaque morceau du score avec
 * le coup choisi.
 *
 *   pnpm --filter @pipou/backend ai:explain <journal.jsonl> <id> [--note <legacy|learned|fichier.json>]
 *
 * Le rejeu voit l'état complet, pas la vue déterminisée de l'IA : les scores
 * peuvent différer un peu de ceux du journal quand des cartes cachées comptent.
 */
type Parts = Record<string, number>;

function main(argv: string[]): void {
  const noteAt = argv.indexOf('--note');
  const noteArg = noteAt >= 0 ? argv[noteAt + 1] : undefined;
  const rest =
    noteAt >= 0
      ? argv.filter((_, i) => i !== noteAt && i !== noteAt + 1)
      : argv;
  const [log, id] = rest;
  const note = evaluatorOf(parseNote(noteArg, 'legacy'));
  if (!log || !id) throw new Error('usage : ai:explain <journal.jsonl> <id>');
  const d = readDecisions(log).find((x) => x.id === id);
  if (!d) throw new Error(`décision introuvable : ${id}`);

  const engine = createEngine(fixedRng());
  const rows: { text: string; score: number; parts: Parts; chosen: boolean }[] =
    [];
  for (const c of d.candidates) {
    const state = structuredClone(d.state);
    const res = engine.dispatch(state, d.seat, c.action);
    if (res.error) continue;
    const parts: Parts = {};
    const score = note(state, d.seat, d.archetype, false, parts);
    rows.push({
      text: describeAction(c.action, d.state),
      score,
      parts,
      chosen: JSON.stringify(c.action) === JSON.stringify(d.chosen),
    });
  }
  const before: Parts = {};
  const base = note(
    structuredClone(d.state),
    d.seat,
    d.archetype,
    false,
    before,
  );
  console.log(
    `${d.id} tour ${d.turn} ${d.phase} | IA ${d.archetype} niv ${d.level} | score avant de jouer ${Math.round(base)}`,
  );
  const ref = rows.find((r) => r.chosen) ?? rows[0];
  for (const r of rows.sort((a, b) => b.score - a.score)) {
    const deltas = Object.keys({ ...r.parts, ...ref.parts })
      .map((k) => [k, (r.parts[k] ?? 0) - (ref.parts[k] ?? 0)] as const)
      .filter(([, v]) => Math.abs(v) >= 1)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.round(v)}`);
    console.log(
      `${r.chosen ? '*' : ' '} ${String(Math.round(r.score)).padStart(8)}  ${r.text}`,
    );
    if (!r.chosen)
      console.log(
        `            vs choisi : ${deltas.join(', ') || 'identique'}`,
      );
  }
  const parts = Object.entries(ref.parts)
    .map(([k, v]) => `${k} ${Math.round(v)}`)
    .join(', ');
  console.log(`  détail du coup choisi : ${parts}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
