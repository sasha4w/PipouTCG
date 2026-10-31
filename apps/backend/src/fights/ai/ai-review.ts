import type { GameAction } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import type { Annotation } from './ai-feedback';
import type { DecisionRecord } from './decision-log';

/** Regret à partir duquel une décision est signalée « suspecte ». */
export const SUSPECT_REGRET = 5;

/**
 * Écart `evaluate` entre le meilleur candidat et le coup choisi (≥ 0).
 * INDICATEUR APPROXIMATIF : `evaluate` ne regarde qu'un coup, et un cerveau
 * qui planifie choisit pour des suites que ce score ne voit pas. 0 s'il n'y a
 * pas de candidat ou si le coup choisi n'en fait pas partie (repli).
 */
export function heuristicRegret(record: DecisionRecord): number {
  const chosen = record.candidates.find((c) =>
    sameAction(c.action, record.chosen),
  );
  if (!chosen) return 0;
  // end_phase : le glouton le choisit si aucun autre coup ne bat la base
  if (chosen.action.type === 'end_phase' && record.baseline !== undefined) {
    const others = record.candidates.filter(
      (c) => c.action.type !== 'end_phase',
    );
    const bestOther = Math.max(...others.map((c) => c.score));
    return Math.max(0, bestOther - record.baseline);
  }
  const best = Math.max(...record.candidates.map((c) => c.score));
  return Math.max(0, best - chosen.score);
}

/** Décisions à regarder en premier : écart d'au moins `minRegret`, plus grand d'abord. */
export function suspects(
  records: DecisionRecord[],
  minRegret = 1,
): { record: DecisionRecord; regret: number }[] {
  return records
    .map((record) => ({ record, regret: heuristicRegret(record) }))
    .filter((s) => s.regret >= minRegret)
    .sort((a, b) => b.regret - a.regret);
}

export function sameAction(a: GameAction, b: GameAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Les cartes de l'état, par instanceId, pour afficher des noms plutôt que des UUID. */
function cardNames(state: GameState): Map<string, string> {
  const names = new Map<string, string>();
  for (const p of [state.player1, state.player2]) {
    const zones = [
      p.hand,
      p.deck,
      p.graveyard,
      p.banished,
      p.primeDeck,
      p.monsterZones,
      p.supportZones,
    ];
    for (const zone of zones)
      for (const c of zone) {
        if (!c) continue;
        const card = 'card' in c ? c.card : c;
        names.set(card.instanceId, card.baseCard.name);
        names.set(c.instanceId, card.baseCard.name);
      }
  }
  return names;
}

/** `{"type":"attack",…}` lisible : les instanceId deviennent des noms de carte. */
export function describeAction(action: GameAction, state: GameState): string {
  const names = cardNames(state);
  const { type, ...rest } = action as GameAction & Record<string, unknown>;
  const parts = Object.entries(rest).map(([k, v]) => {
    const show = (x: unknown): string =>
      typeof x === 'string' && names.has(x) ? names.get(x)! : JSON.stringify(x);
    return `${k}=${Array.isArray(v) ? v.map(show).join(',') : show(v)}`;
  });
  return [type, ...parts].join(' ');
}

export interface ReviewedDecision {
  decision: DecisionRecord;
  annotations: Annotation[];
}

/**
 * Rattache chaque annotation à sa décision. Une annotation dont la décision
 * n'est pas dans le journal est renvoyée à part (orphelines).
 */
export function joinAnnotations(
  decisions: DecisionRecord[],
  annotations: Annotation[],
): { reviewed: ReviewedDecision[]; orphans: Annotation[] } {
  const byId = new Map(
    decisions.map((d): [string, ReviewedDecision] => [
      d.id,
      { decision: d, annotations: [] },
    ]),
  );
  const orphans: Annotation[] = [];
  for (const a of annotations) {
    const target = byId.get(a.decisionId);
    if (target) target.annotations.push(a);
    else orphans.push(a);
  }
  return { reviewed: [...byId.values()], orphans };
}

/** Candidats classés par score décroissant, pour `show`. */
export function rankedCandidates(
  record: DecisionRecord,
): { index: number; action: GameAction; score: number; chosen: boolean }[] {
  return record.candidates
    .map((c, index) => ({
      index,
      action: c.action,
      score: c.score,
      chosen: sameAction(c.action, record.chosen),
    }))
    .sort((a, b) => b.score - a.score);
}
