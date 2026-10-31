import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { AiPlayer } from './ai-player';
import type { AiProfile } from './ai-player';
import { parseJsonl, toJsonlLine } from './decision-log';
import type { DecisionRecord } from './decision-log';

const engine = createEngine();
const profile: AiProfile = { archetype: 'pipou', level: 3 };

function battleScenario() {
  return scenario({
    turn: 'p2',
    phase: 'battle',
    p1: {
      monsters: [
        monsterCard('Colosse', { atk: 50, hp: 5000 }),
        monsterCard('Moucheron', { atk: 0, hp: 100 }),
      ],
    },
    p2: {
      primes: 1,
      monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
    },
  });
}

describe('journal de décisions', () => {
  it('sans sink ou avec sink : même décision', () => {
    const plain = new AiPlayer(engine, () => 0.99);
    const logged = new AiPlayer(engine, () => 0.99);
    logged.setDecisionSink(() => undefined);

    const game = battleScenario();
    const before = structuredClone(game);

    expect(logged.chooseAction(game, 'p2', profile)).toEqual(
      plain.chooseAction(game, 'p2', profile),
    );
    expect(game).toEqual(before);
  });

  it('enregistre candidats, scores et coup choisi', () => {
    const records: DecisionRecord[] = [];
    const ai = new AiPlayer(engine, () => 0.99);
    ai.setDecisionSink((r) => records.push(r), 'test');
    const game = battleScenario();

    const action = ai.chooseAction(game, 'p2', profile);

    expect(records).toHaveLength(1);
    const [rec] = records;
    expect(rec.id).toBe(`test:${game.matchId}:p2:1`);
    expect(rec.chosen).toEqual(action);
    expect(rec.source).toBe('greedy');
    expect(rec.phase).toBe('battle');
    expect(rec.candidates.length).toBeGreaterThan(1);
    expect(rec.candidates.map((c) => c.action)).toContainEqual(action);
    expect(rec.candidates.every((c) => Number.isFinite(c.score))).toBe(true);
  });

  it('l’état enregistré est une copie : muter la partie ne le change pas', () => {
    const records: DecisionRecord[] = [];
    const ai = new AiPlayer(engine, () => 0.99);
    ai.setDecisionSink((r) => records.push(r));
    const game = battleScenario();

    const action = ai.chooseAction(game, 'p2', profile);
    engine.dispatch(game, 'p2', action);

    expect(game.phase).toBe('finished');
    expect(records[0].state.phase).toBe('battle');
    expect(records[0].state.winner).toBeUndefined();
    expect(records[0].state).not.toBe(game);
  });

  it('un sink qui lève ne gêne pas la décision', () => {
    const ai = new AiPlayer(engine, () => 0.99);
    ai.setDecisionSink(() => {
      throw new Error('disque plein');
    });

    expect(ai.chooseAction(battleScenario(), 'p2', profile).type).toBe(
      'attack',
    );
  });

  it('JSONL : aller-retour sans perte', () => {
    const records: DecisionRecord[] = [];
    const ai = new AiPlayer(engine, () => 0.99);
    ai.setDecisionSink((r) => records.push(r));
    ai.chooseAction(battleScenario(), 'p2', profile);

    const text = records.map(toJsonlLine).join('\n') + '\n';
    const back = parseJsonl<DecisionRecord>(text);

    expect(back).toEqual(JSON.parse(JSON.stringify(records)));
    expect(() => parseJsonl('{"a":1}\n{oups')).toThrow('ligne 2');
  });
});
