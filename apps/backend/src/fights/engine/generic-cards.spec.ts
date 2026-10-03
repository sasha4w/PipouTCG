import {
  ActionType,
  Archetype,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { handNames, monsterNamed, scenario, P1_ID } from '../testing/scenario';

describe('GameEngine — effets génériques (ex-cartes codées en dur)', () => {
  const engine = createEngine();

  it('Clairon : recycler la carte déclenche ON_RECYCLE (pioche)', () => {
    const clairon = ephemeralCard('Clairon', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.GAIN_RECYCLE_ENERGY, EffectTarget.PLAYER, { value: 2 }),
      ]),
      effect(EffectTrigger.ON_RECYCLE, [
        act(ActionType.DRAW, EffectTarget.PLAYER, { value: 1 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [clairon], deck: [monsterCard('Renfort')] },
    });

    engine.dispatch(game, 'p1', { type: 'recycle', handIndex: 0 });

    expect(game.player1.recycleEnergy).toBe(1);
    expect(handNames(game, 'p1')).toEqual(['Renfort']);
  });

  it('Touille : seule la carte source devient gratuite, une fois', () => {
    const touille = monsterCard('Touille', {
      cost: 2,
      archetype: Archetype.PIPOU,
      effects: [
        effect(
          EffectTrigger.ON_ALLY_SUMMON,
          [act(ActionType.SET_FREE_SUMMON, EffectTarget.PLAYER, { value: 1 })],
          { type: EffectConditionType.ARCHETYPE_ON_BOARD, value: 'pipou' },
        ),
      ],
    });
    const game = scenario({
      p1: {
        hand: [
          monsterCard('Recrue', { archetype: Archetype.PIPOU }),
          touille,
          monsterCard('Lourdaud', { cost: 2 }),
        ],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });
    expect(game.player1.freeSummonInstanceIds).toEqual([
      game.player1.hand[0].instanceId,
    ]);

    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 1,
        zoneIndex: 1,
        paymentHandIndices: [],
      }).error,
    ).toContain('Pas assez de cartes');
    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 1,
        paymentHandIndices: [],
      }),
    ).toEqual({});
    expect(game.player1.freeSummonInstanceIds).toEqual([]);
  });

  it('Zeta : invocable sur le terrain adverse grâce à son passif, et seulement elle', () => {
    const zeta = monsterCard('Zeta', {
      atk: 0,
      hp: 400,
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.SET_TURN_COUNTER, EffectTarget.SELF, { value: 3 }),
        ]),
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [monsterCard('Banal'), zeta] } });

    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
        onOpponentSide: true,
      }).error,
    ).toBe('Banal ne peut pas être invoqué sur le terrain adverse');

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 1,
      zoneIndex: 2,
      paymentHandIndices: [],
      onOpponentSide: true,
    });
    const placed = monsterNamed(game, 'p2', 'Zeta');
    expect(game.player2.monsterZones[2]).toBe(placed);
    expect(placed).toMatchObject({ ownerUserId: P1_ID, turnCounter: 3 });
  });
});
