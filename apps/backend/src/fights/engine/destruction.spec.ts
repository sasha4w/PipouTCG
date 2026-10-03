import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
} from '../testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
  P1_ID,
} from '../testing/scenario';

describe('GameEngine — destruction', () => {
  const engine = createEngine();

  it('combat : ON_DEATH, monstre et équipement au cimetière, le propriétaire pioche', () => {
    const lutin = monsterCard('Lutin', {
      atk: 0,
      hp: 300,
      effects: [
        effect(EffectTrigger.ON_DEATH, [
          act(ActionType.DRAW, EffectTarget.PLAYER),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: {
        monsters: [{ card: lutin, equipments: [equipmentCard('Casque', [])] }],
        deck: [monsterCard('A'), monsterCard('B')],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Lutin').instanceId,
    });

    expect(graveyardNames(game, 'p2')).toEqual(['Casque', 'Lutin']);
    expect(handNames(game, 'p2')).toEqual(['A', 'B']);
  });

  it("effet de l'adversaire : la victime pioche", () => {
    const meteore = ephemeralCard('Météore', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 1000 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [meteore] },
      p2: { monsters: [monsterCard('Lutin')], deck: [monsterCard('A')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.player2.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p2')).toEqual(['A']);
  });

  it('sacrifice par son propre effet : pas de pioche', () => {
    const sacrifice = ephemeralCard('Sacrifice', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ALLIES),
      ]),
    ]);
    const game = scenario({
      p1: {
        hand: [sacrifice],
        monsters: [monsterCard('Pion')],
        deck: [monsterCard('A')],
      },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p1')).toEqual([]);
  });

  it("compteur de tour expiré : Prime pour le poseur, pas de pioche pour l'hôte", () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p2: {
        monsters: [
          {
            card: monsterCard('Virus', { atk: 0, hp: 400 }),
            patch: { turnCounter: 1, ownerUserId: P1_ID },
          },
        ],
      },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(game.player1.primes).toBe(5);
    expect(graveyardNames(game, 'p2')).toEqual(['Virus']);
    expect(handNames(game, 'p2')).toEqual([]);
  });
});
