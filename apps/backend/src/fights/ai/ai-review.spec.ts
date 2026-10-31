import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { monsterNamed, scenario } from '../testing/scenario';
import { parseAnnotation } from './ai-feedback';
import {
  describeAction,
  heuristicRegret,
  joinAnnotations,
  rankedCandidates,
  suspects,
} from './ai-review';
import { AiPlayer } from './ai-player';
import type { DecisionRecord } from './decision-log';

const engine = createEngine();

function recordOne(): { record: DecisionRecord; attackerName: string } {
  const game = scenario({
    turn: 'p2',
    phase: 'battle',
    p1: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
    p2: { primes: 1, monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] },
  });
  const records: DecisionRecord[] = [];
  const ai = new AiPlayer(engine, () => 0.99);
  ai.setDecisionSink((r) => records.push(r));
  ai.chooseAction(game, 'p2', { archetype: 'pipou', level: 3 });
  expect(monsterNamed(game, 'p2', 'Lame')).toBeDefined();
  return { record: records[0], attackerName: 'Lame' };
}

describe('revue des décisions', () => {
  it('regret nul quand le coup choisi est le meilleur candidat', () => {
    const { record } = recordOne();
    expect(heuristicRegret(record)).toBe(0);
  });

  it('regret = écart au meilleur score ; suspects triés', () => {
    const { record } = recordOne();
    const worst = rankedCandidates(record).at(-1)!;
    const bad: DecisionRecord = {
      ...record,
      id: 'bad',
      chosen: worst.action,
    };

    const found = suspects([record, bad], 0.001);

    expect(found.map((s) => s.record.id)).toEqual(['bad']);
    expect(found[0].regret).toBeCloseTo(
      rankedCandidates(record)[0].score - worst.score,
    );
  });

  it('end_phase : regret mesuré contre la base, pas contre son propre score', () => {
    const { record } = recordOne();
    const endPhase = { type: 'end_phase' } as const;
    const best = Math.max(...record.candidates.map((c) => c.score));
    const base: DecisionRecord = {
      ...record,
      chosen: endPhase,
      candidates: [
        ...record.candidates.filter((c) => c.action.type !== 'end_phase'),
        { action: endPhase, score: best - 1000 },
      ],
    };

    // La base dépasse tous les coups : finir la phase est correct
    expect(heuristicRegret({ ...base, baseline: best + 1 })).toBe(0);
    // Un coup bat la base de 50 : écart de 50
    expect(heuristicRegret({ ...base, baseline: best - 50 })).toBeCloseTo(50);
  });

  it('describeAction remplace les instanceId par les noms de carte', () => {
    const { record } = recordOne();
    expect(describeAction(record.chosen, record.state)).toContain('Lame');
    expect(describeAction(record.chosen, record.state)).toContain('Moucheron');
  });

  it('joinAnnotations rattache à la bonne décision et isole les orphelines', () => {
    const { record } = recordOne();
    const ok = parseAnnotation({ decisionId: record.id, verdict: 'good' });
    const orphan = parseAnnotation({
      decisionId: 'nope',
      verdict: 'uncertain',
    });

    const { reviewed, orphans } = joinAnnotations([record], [ok, orphan]);

    expect(reviewed[0].annotations).toEqual([ok]);
    expect(orphans).toEqual([orphan]);
  });
});

describe('parseAnnotation', () => {
  it('refuse verdict ou catégorie inconnus, better_action sans coup', () => {
    expect(() => parseAnnotation({ decisionId: 'a', verdict: 'nul' })).toThrow(
      'verdict',
    );
    expect(() =>
      parseAnnotation({ decisionId: 'a', verdict: 'good', category: 'x' }),
    ).toThrow('catégorie');
    expect(() =>
      parseAnnotation({ decisionId: 'a', verdict: 'better_action' }),
    ).toThrow('action préférée');
  });

  it('accepte une annotation complète', () => {
    const a = parseAnnotation({
      decisionId: 'a',
      verdict: 'better_action',
      preferred: { type: 'end_phase' },
      category: 'lookahead',
      comment: 'menace létale',
      outcome: 'loss',
    });
    expect(a.preferred).toEqual({ type: 'end_phase' });
    expect(a.createdAt).toEqual(expect.any(String));
  });
});
