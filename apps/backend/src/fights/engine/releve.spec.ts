import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import type { GameAction } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { listCandidates } from '../ai/candidate-actions';
import { createEngine } from '../testing/engine';
import { act, effect, monsterCard } from '../testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();

const releve = (n: number) =>
  effect(EffectTrigger.PASSIVE, [
    act(ActionType.RELEVE, EffectTarget.SELF, { value: n }),
  ]);
const chef = () =>
  monsterCard('Chef', { cost: 3, archetype: 'pipou', effects: [releve(2)] });
const soldat = (name: string, extra = {}) =>
  monsterCard(name, { archetype: 'pipou', ...extra });

function fullBoard(hand = [chef()], third = soldat('C')): GameState {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand, monsters: [soldat('A'), soldat('B'), third] },
  });
}

const ids = (game: GameState, ...names: string[]) =>
  names.map((n) => monsterNamed(game, 'p1', n).instanceId);

function summonByReleve(
  game: GameState,
  sacrificed: string[],
  zoneIndex: number,
): ReturnType<typeof engine.dispatch> {
  return engine.dispatch(game, 'p1', {
    type: 'summon',
    handIndex: 0,
    zoneIndex,
    paymentHandIndices: [],
    releveInstanceIds: sacrificed,
  });
}

describe('Relève', () => {
  it('invoque à la place de 2 alliés Pipou sur un terrain plein', () => {
    const game = fullBoard();
    expect(summonByReleve(game, ids(game, 'A', 'B'), 0).error).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Chef')).toBeDefined();
    expect(graveyardNames(game, 'p1')).toEqual(
      expect.arrayContaining(['A', 'B']),
    );
    expect(handNames(game, 'p1')).toEqual([]);
    expect(seatState(game, 'p1').recycleEnergy).toBe(0);
  });

  it('les sacrifiés déclenchent leur ON_DEATH sans Prime', () => {
    const pioche = effect(EffectTrigger.ON_DEATH, [
      act(ActionType.DRAW, EffectTarget.PLAYER, { value: 1 }),
    ]);
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [chef()],
        monsters: [
          soldat('A', { effects: [pioche] }),
          soldat('B'),
          soldat('C'),
        ],
      },
    });
    expect(summonByReleve(game, ids(game, 'A', 'B'), 0).error).toBeUndefined();
    expect(handNames(game, 'p1')).toHaveLength(1);
    expect(seatState(game, 'p1').primes).toBe(6);
    expect(seatState(game, 'p2').primes).toBe(6);
  });

  describe('refus, état inchangé', () => {
    const cases: [string, (g: GameState) => GameAction][] = [
      [
        '1 sacrifié pour Relève (2)',
        (g) => ({
          type: 'summon',
          handIndex: 0,
          zoneIndex: 0,
          paymentHandIndices: [],
          releveInstanceIds: ids(g, 'A'),
        }),
      ],
      [
        'zone occupée par un allié non sacrifié',
        (g) => ({
          type: 'summon',
          handIndex: 0,
          zoneIndex: 2,
          paymentHandIndices: [],
          releveInstanceIds: ids(g, 'A', 'B'),
        }),
      ],
    ];
    it.each(cases)('%s', (_name, build) => {
      const game = fullBoard();
      const before = JSON.stringify(seatState(game, 'p1'));
      expect(engine.dispatch(game, 'p1', build(game)).error).toBeDefined();
      expect(JSON.stringify(seatState(game, 'p1'))).toBe(before);
    });

    it('un allié non Pipou', () => {
      const game = fullBoard(
        [chef()],
        monsterCard('C', { archetype: 'dragon' }),
      );
      const before = JSON.stringify(seatState(game, 'p1'));
      expect(summonByReleve(game, ids(game, 'A', 'C'), 0).error).toBeDefined();
      expect(JSON.stringify(seatState(game, 'p1'))).toBe(before);
    });

    it('une carte sans Relève', () => {
      const game = fullBoard([soldat('Sans', { cost: 0 })]);
      const before = JSON.stringify(seatState(game, 'p1'));
      expect(summonByReleve(game, ids(game, 'A', 'B'), 0).error).toBeDefined();
      expect(JSON.stringify(seatState(game, 'p1'))).toBe(before);
    });
  });

  it('sans releveInstanceIds, le paiement habituel est inchangé', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [chef(), soldat('X'), soldat('Y'), soldat('Z')] },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [1, 2, 3],
      }).error,
    ).toBeUndefined();
    expect([...graveyardNames(game, 'p1')].sort()).toEqual(['X', 'Y', 'Z']);
  });

  it('IA : Relève proposée et acceptée par le moteur sur terrain plein', () => {
    const game = fullBoard();
    const candidate = listCandidates(game, 'p1').find(
      (a) => a.type === 'summon' && a.releveInstanceIds?.length === 2,
    );
    expect(candidate).toBeDefined();
    expect(engine.dispatch(game, 'p1', candidate!).error).toBeUndefined();
  });
});
