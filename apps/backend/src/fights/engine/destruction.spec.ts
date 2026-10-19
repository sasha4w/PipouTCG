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

  describe('cartes token', () => {
    const tokenise = (m: {
      card: { token?: boolean };
      equipments: { token?: boolean }[];
    }) => {
      m.card.token = true;
      m.equipments.forEach((e) => (e.token = true));
    };

    it('détruit : ni le monstre ni ses équipements token ne vont au cimetière', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
        p2: {
          monsters: [
            {
              card: monsterCard('Copie', { atk: 0, hp: 300 }),
              equipments: [equipmentCard('Casque', [])],
            },
          ],
        },
      });
      tokenise(monsterNamed(game, 'p2', 'Copie'));

      engine.dispatch(game, 'p1', {
        type: 'attack',
        attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
        targetInstanceId: monsterNamed(game, 'p2', 'Copie').instanceId,
      });

      expect(game.player2.monsterZones[0]).toBeNull();
      expect(graveyardNames(game, 'p2')).toEqual([]);
    });

    it('renvoyé en main (éphémère) : la main ne change pas', () => {
      const migration = ephemeralCard('Migration', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_TO_HAND, EffectTarget.TARGET_ALLY),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [migration],
          monsters: [
            {
              card: monsterCard('Copie'),
              equipments: [equipmentCard('Casque', [])],
            },
          ],
        },
      });
      const copie = monsterNamed(game, 'p1', 'Copie');
      tokenise(copie);

      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: copie.instanceId,
      });

      expect(game.player1.monsterZones[0]).toBeNull();
      expect(handNames(game, 'p1')).toEqual([]);
    });

    it('sert de base à une évolution : cimetière sans le token', () => {
      const dragon = (name: string, extra = {}) =>
        monsterCard(name, {
          archetype: 'dragon',
          lineage: 'feros',
          element: 'fire',
          ...extra,
        });
      const game = scenario({
        p1: {
          hand: [dragon('Jeune Feros', { stage: 'young', cost: 0, hp: 900 })],
          monsters: [dragon('Bébé Feros', { stage: 'baby', cost: 0 })],
        },
      });
      tokenise(monsterNamed(game, 'p1', 'Bébé Feros'));

      const res = engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Bébé Feros').instanceId,
        paymentHandIndices: [],
      });

      expect(res).toEqual({});
      expect(monsterNamed(game, 'p1', 'Jeune Feros')).toBeDefined();
      expect(graveyardNames(game, 'p1')).toEqual([]);
    });
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
