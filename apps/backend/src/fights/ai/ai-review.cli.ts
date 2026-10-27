import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { parseAnnotation } from './ai-feedback';
import type { Annotation } from './ai-feedback';
import {
  describeAction,
  heuristicRegret,
  joinAnnotations,
  rankedCandidates,
  suspects,
} from './ai-review';
import { parseJsonl, readDecisions } from './decision-log';
import type { DecisionRecord } from './decision-log';

/**
 * Revue des décisions de l'IA.
 *
 *   pnpm --filter @pipou/backend ai:review list <journal.jsonl>
 *   pnpm --filter @pipou/backend ai:review suspects <journal.jsonl> [--min 1]
 *   pnpm --filter @pipou/backend ai:review show <journal.jsonl> <id>
 *   pnpm --filter @pipou/backend ai:review annotate <journal.jsonl> <id> \
 *       --verdict better_action --prefer <n° de candidat> \
 *       [--category lookahead] [--comment "..."] [--outcome win|loss|draw]
 *   pnpm --filter @pipou/backend ai:review export <journal.jsonl>
 *
 * Les annotations vont dans `<journal>.annotations.jsonl`.
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

function annotationsPath(log: string): string {
  return `${log}.annotations.jsonl`;
}

function readAnnotations(log: string): Annotation[] {
  const path = annotationsPath(log);
  if (!existsSync(path)) return [];
  return parseJsonl<unknown>(readFileSync(path, 'utf8')).map(parseAnnotation);
}

function find(decisions: DecisionRecord[], id: string): DecisionRecord {
  const d = decisions.find((x) => x.id === id);
  if (!d) throw new Error(`décision introuvable : ${id}`);
  return d;
}

function line(d: DecisionRecord, marks: string): string {
  return `${d.id}  t${d.turn} ${d.phase} niv${d.level} ${d.source}  ${describeAction(d.chosen, d.state)}  regret=${heuristicRegret(d).toFixed(2)} ${marks}`;
}

function main(argv: string[]): void {
  const [cmd, log, ...rest] = argv;
  if (!cmd || !log) throw new Error('usage : ai:review <commande> <journal>');
  const decisions = readDecisions(log);
  const annotated = new Set(readAnnotations(log).map((a) => a.decisionId));
  const mark = (d: DecisionRecord) => (annotated.has(d.id) ? '[annoté]' : '');

  if (cmd === 'list') {
    for (const d of decisions) console.log(line(d, mark(d)));
  } else if (cmd === 'suspects') {
    const min = Number(flags(rest).min ?? 1);
    for (const s of suspects(decisions, min))
      console.log(line(s.record, mark(s.record)));
  } else if (cmd === 'show') {
    const d = find(decisions, rest[0]);
    console.log(line(d, mark(d)));
    for (const c of rankedCandidates(d))
      console.log(
        `  #${c.index} ${c.chosen ? '*' : ' '} ${c.score.toFixed(2).padStart(10)}  ${describeAction(c.action, d.state)}`,
      );
    for (const x of d.simulationCrashes)
      console.log(
        `  CRASH ${describeAction(x.action, d.state)} — ${x.message}`,
      );
  } else if (cmd === 'annotate') {
    const [id, ...opts] = rest;
    const d = find(decisions, id);
    const f = flags(opts);
    const preferred =
      f.prefer === undefined
        ? undefined
        : d.candidates[Number(f.prefer)]?.action;
    if (f.prefer !== undefined && !preferred)
      throw new Error(`candidat #${f.prefer} inexistant`);
    const annotation = parseAnnotation({
      decisionId: id,
      verdict: f.verdict,
      preferred,
      category: f.category,
      comment: f.comment,
      outcome: f.outcome,
    });
    appendFileSync(annotationsPath(log), JSON.stringify(annotation) + '\n');
    console.log(`annotation ajoutée à ${annotationsPath(log)}`);
  } else if (cmd === 'export') {
    const { reviewed, orphans } = joinAnnotations(
      decisions,
      readAnnotations(log),
    );
    for (const r of reviewed) console.log(JSON.stringify(r));
    if (orphans.length > 0)
      console.error(`${orphans.length} annotation(s) sans décision`);
  } else {
    throw new Error(`commande inconnue : ${cmd}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
