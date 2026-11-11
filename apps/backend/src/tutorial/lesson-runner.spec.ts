import { ephemeralCard, monsterCard } from '../fights/testing/cards';
import { scenario, seatState } from '../fights/testing/scenario';
import type { GameAction } from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { Lesson } from './lesson.types';
import { LessonRunner } from './lesson-runner';

const lesson = (steps: Lesson['steps']): Lesson => ({
  id: 'first-turn',
  board: { p1: {}, p2: {} },
  steps,
});

function game(): GameState {
  return scenario({
    p1: {
      hand: [
        monsterCard('Alpha'),
        monsterCard('Beta'),
        ephemeralCard('Soin', []),
      ],
      monsters: [monsterCard('Gamma')],
    },
    p2: { monsters: [monsterCard('Delta')], hand: [monsterCard('Epsilon')] },
  });
}

describe('LessonRunner', () => {
  it('commence à la première étape et avance une à une', () => {
    const r = new LessonRunner(
      lesson([
        { kind: 'info', key: 'a' },
        { kind: 'player', key: 'b', expect: { type: 'end_phase' } },
      ]),
    );
    expect(r.step?.key).toBe('a');
    expect(r.done).toBe(false);
    r.advance();
    expect(r.step?.key).toBe('b');
    r.advance();
    expect(r.done).toBe(true);
    expect(r.step).toBeUndefined();
  });

  it("refuse toute action pendant une étape d'information", () => {
    const r = new LessonRunner(lesson([{ kind: 'info', key: 'a' }]));
    expect(r.matches(game(), 'p1', { type: 'end_phase' })).toBe(false);
  });

  it('accepte seulement la bonne carte pour recycler', () => {
    const g = game();
    const r = new LessonRunner(
      lesson([
        { kind: 'player', key: 'a', expect: { type: 'recycle', card: 'Beta' } },
      ]),
    );
    expect(r.matches(g, 'p1', { type: 'recycle', handIndex: 0 })).toBe(false);
    expect(r.matches(g, 'p1', { type: 'recycle', handIndex: 1 })).toBe(true);
    expect(r.matches(g, 'p1', { type: 'end_phase' })).toBe(false);
  });

  it("n'accepte l'invocation que sur la zone attendue", () => {
    const g = game();
    const r = new LessonRunner(
      lesson([
        {
          kind: 'player',
          key: 'a',
          expect: { type: 'summon', card: 'Alpha', zone: 1 },
        },
      ]),
    );
    const summon = (zoneIndex: number, handIndex = 0) =>
      ({
        type: 'summon',
        handIndex,
        zoneIndex,
        paymentHandIndices: [],
      }) as GameAction;
    expect(r.matches(g, 'p1', summon(0))).toBe(false);
    expect(r.matches(g, 'p1', summon(1, 1))).toBe(false);
    expect(r.matches(g, 'p1', summon(1))).toBe(true);
  });

  it('vérifie le paiement quand la leçon le précise', () => {
    const g = game();
    const r = new LessonRunner(
      lesson([
        {
          kind: 'player',
          key: 'a',
          expect: { type: 'summon', card: 'Alpha', zone: 1, pay: ['Beta'] },
        },
      ]),
    );
    const summon = (pay: number[]) =>
      ({
        type: 'summon',
        handIndex: 0,
        zoneIndex: 1,
        paymentHandIndices: pay,
      }) as GameAction;
    expect(r.matches(g, 'p1', summon([2]))).toBe(false);
    expect(r.matches(g, 'p1', summon([]))).toBe(false);
    expect(r.matches(g, 'p1', summon([1]))).toBe(true);
  });

  it("reconnaît l'attaque d'un monstre sur sa cible, ou directe", () => {
    const g = game();
    const gamma = seatState(g, 'p1').monsterZones[0]!;
    const delta = seatState(g, 'p2').monsterZones[0]!;
    const r = new LessonRunner(
      lesson([
        {
          kind: 'player',
          key: 'a',
          expect: { type: 'attack', attacker: 'Gamma', target: 'Delta' },
        },
        {
          kind: 'player',
          key: 'b',
          expect: { type: 'attack', attacker: 'Gamma' },
        },
      ]),
    );
    expect(
      r.matches(g, 'p1', {
        type: 'attack',
        attackerInstanceId: gamma.instanceId,
        direct: true,
      }),
    ).toBe(false);
    expect(
      r.matches(g, 'p1', {
        type: 'attack',
        attackerInstanceId: gamma.instanceId,
        targetInstanceId: delta.instanceId,
      }),
    ).toBe(true);
    r.advance();
    expect(
      r.matches(g, 'p1', {
        type: 'attack',
        attackerInstanceId: gamma.instanceId,
        direct: true,
      }),
    ).toBe(true);
  });

  it('accepte un support seulement sur la cible attendue', () => {
    const g = game();
    const delta = seatState(g, 'p2').monsterZones[0]!;
    const gamma = seatState(g, 'p1').monsterZones[0]!;
    const r = new LessonRunner(
      lesson([
        {
          kind: 'player',
          key: 'a',
          expect: { type: 'play_support', card: 'Soin', target: 'Delta' },
        },
      ]),
    );
    expect(
      r.matches(g, 'p1', {
        type: 'play_support',
        handIndex: 2,
        targetInstanceId: gamma.instanceId,
      }),
    ).toBe(false);
    expect(
      r.matches(g, 'p1', {
        type: 'play_support',
        handIndex: 2,
        targetInstanceId: delta.instanceId,
      }),
    ).toBe(true);
  });

  it("résout le coup scripté de l'adversaire en action du moteur", () => {
    const g = game();
    const gamma = seatState(g, 'p1').monsterZones[0]!;
    const delta = seatState(g, 'p2').monsterZones[0]!;
    const r = new LessonRunner(
      lesson([
        {
          kind: 'opponent',
          key: 'a',
          do: { type: 'attack', attacker: 'Delta', target: 'Gamma' },
        },
        {
          kind: 'opponent',
          key: 'b',
          do: { type: 'summon', card: 'Epsilon', zone: 2, pay: [] },
        },
      ]),
    );
    expect(r.scripted(g, 'p2')).toEqual({
      type: 'attack',
      attackerInstanceId: delta.instanceId,
      targetInstanceId: gamma.instanceId,
      direct: false,
    });
    r.advance();
    expect(r.scripted(g, 'p2')).toEqual({
      type: 'summon',
      handIndex: 0,
      zoneIndex: 2,
      paymentHandIndices: [],
    });
  });

  it("n'a pas de coup scripté pendant une étape du joueur", () => {
    const r = new LessonRunner(
      lesson([{ kind: 'player', key: 'a', expect: { type: 'end_phase' } }]),
    );
    expect(r.scripted(game(), 'p2')).toBeNull();
  });

  it('désigne ce que la bulle met en avant (carte, zone, bouton)', () => {
    const g = game();
    const hand = seatState(g, 'p1').hand;
    const r = new LessonRunner(
      lesson([
        {
          kind: 'player',
          key: 'a',
          expect: { type: 'summon', card: 'Alpha', zone: 1, pay: ['Beta'] },
        },
        { kind: 'player', key: 'b', expect: { type: 'end_phase' } },
      ]),
    );
    const view = r.view(g, 'p1')!;
    expect(view).toMatchObject({
      lessonId: 'first-turn',
      index: 0,
      total: 2,
      kind: 'player',
      textKey: 'tutorial.first-turn.a',
    });
    expect(view.hint?.cards).toEqual([hand[0].instanceId, hand[1].instanceId]);
    expect(view.hint?.zones).toEqual([
      { side: 'me', kind: 'monster', index: 1 },
    ]);
    r.advance();
    expect(r.view(g, 'p1')!.hint).toEqual({ button: 'end_phase' });
  });

  it('ne compte que les étapes visibles du joueur dans la progression', () => {
    const g = game();
    const r = new LessonRunner(
      lesson([
        { kind: 'info', key: 'a' },
        { kind: 'opponent', key: 'b', do: { type: 'end_phase' } },
        { kind: 'player', key: 'c', expect: { type: 'end_phase' } },
      ]),
    );
    r.advance();
    expect(r.view(g, 'p1')).toMatchObject({
      index: 1,
      total: 2,
      kind: 'opponent',
    });
    r.advance();
    expect(r.view(g, 'p1')).toMatchObject({
      index: 1,
      total: 2,
      kind: 'player',
    });
  });

  it('range les textes communs sous tutorial.common', () => {
    const r = new LessonRunner(
      lesson([{ kind: 'info', key: 'common.endTurn' }]),
    );
    expect(r.view(game(), 'p1')!.textKey).toBe('tutorial.common.endTurn');
  });

  it('« Finir le tour » accepte end_phase et met en avant le bouton dédié', () => {
    const g = game();
    const r = new LessonRunner(
      lesson([{ kind: 'player', key: 'a', expect: { type: 'end_turn' } }]),
    );
    expect(r.matches(g, 'p1', { type: 'end_phase' })).toBe(true);
    expect(r.matches(g, 'p1', { type: 'discard', handIndex: 0 })).toBe(false);
    expect(r.view(g, 'p1')!.hint).toEqual({ button: 'end_turn' });
  });

  it("résout l'interdit expliqué par une étape d'information", () => {
    const g = game();
    const r = new LessonRunner(
      lesson([
        {
          kind: 'info',
          key: 'a',
          engineRefuses: { type: 'recycle', card: 'Beta' },
        },
        { kind: 'info', key: 'b' },
      ]),
    );
    expect(r.refusedAction(g, 'p1')).toEqual({ type: 'recycle', handIndex: 1 });
    r.advance();
    expect(r.refusedAction(g, 'p1')).toBeNull();
  });
});
