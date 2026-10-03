import {
  ActionType,
  CardType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  handNames,
  scenario,
  P1_ID,
  P2_ID,
} from '../testing/scenario';

/** Monstre qui, détruit, cherche un « Noyau » dans le deck. */
const eclaireur = (name: string) =>
  monsterCard(name, {
    atk: 500,
    hp: 500,
    effects: [
      effect(EffectTrigger.ON_DEATH, [
        act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, {
          filter: { name: 'Noyau', type: CardType.MONSTER },
        }),
      ]),
    ],
  });

const pillage = () =>
  ephemeralCard('Pillage', [
    effect(EffectTrigger.ON_PLAY, [
      act(ActionType.DISCARD, EffectTarget.OPPONENT, { value: 2 }),
    ]),
  ]);

describe('GameEngine — choix en attente', () => {
  const engine = createEngine();

  it("un choix de l'adversaire bloque la partie jusqu'à sa résolution", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 900, hp: 900 })] },
      p2: {
        monsters: [eclaireur('Éclaireur')],
        deck: [monsterCard('Autre'), monsterCard('Noyau Test')],
      },
    });
    attackWith(engine, game, 'p1', 'Ogre', 'Éclaireur');

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' }).error).toBe(
      "L'adversaire doit d'abord faire son choix",
    );
    const choice = game.pendingChoices[0];
    expect(choice.forUserId).toBe(P2_ID);

    expect(
      engine.dispatch(game, 'p2', {
        type: 'pick_cards',
        instanceIds: [choice.candidates[0].instanceId],
      }),
    ).toEqual({});
    expect(handNames(game, 'p2')).toEqual(['Autre', 'Noyau Test']);
    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({});
  });

  it("les choix s'enchaînent dans l'ordre au lieu de s'écraser", () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        monsters: [eclaireur('Éclaireur A')],
        deck: [monsterCard('Bouche-trou'), monsterCard('Noyau 1')],
      },
      p2: {
        monsters: [eclaireur('Éclaireur B')],
        deck: [monsterCard('Bouche-trou'), monsterCard('Noyau 2')],
      },
    });

    attackWith(engine, game, 'p1', 'Éclaireur A', 'Éclaireur B');

    expect(game.pendingChoices.map((c) => c.forUserId)).toEqual([P1_ID, P2_ID]);
    const [first, second] = game.pendingChoices;
    expect(
      engine.dispatch(game, 'p2', {
        type: 'pick_cards',
        instanceIds: [second.candidates[0].instanceId],
      }).error,
    ).toBe("L'adversaire doit d'abord faire son choix");
    engine.dispatch(game, 'p1', {
      type: 'pick_cards',
      instanceIds: [first.candidates[0].instanceId],
    });
    engine.dispatch(game, 'p2', {
      type: 'pick_cards',
      instanceIds: [second.candidates[0].instanceId],
    });
    expect(game.pendingChoices).toEqual([]);
  });

  it("DISCARD : l'adversaire choisit les cartes défaussées", () => {
    const game = scenario({
      p1: { hand: [pillage()] },
      p2: { hand: ['A', 'B', 'C', 'D'].map((n) => monsterCard(n)) },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
    expect(game.pendingChoices[0]).toMatchObject({
      forUserId: P2_ID,
      count: 2,
      resolution: 'discard',
    });

    engine.dispatch(game, 'p2', {
      type: 'pick_cards',
      instanceIds: [
        game.player2.hand[1].instanceId,
        game.player2.hand[3].instanceId,
      ],
    });

    expect(handNames(game, 'p2')).toEqual(['A', 'C']);
    expect(graveyardNames(game, 'p2')).toEqual(['B', 'D']);
  });

  it('DISCARD sur une main trop petite défausse tout, sans choix', () => {
    const game = scenario({
      p1: { hand: [pillage()] },
      p2: { hand: [monsterCard('Seule')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.pendingChoices).toEqual([]);
    expect(graveyardNames(game, 'p2')).toEqual(['Seule']);
  });

  it('le timeout vide la file de choix et fait avancer la partie', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 900, hp: 900 })] },
      p2: {
        monsters: [eclaireur('Éclaireur')],
        deck: [monsterCard('Autre'), monsterCard('Noyau Test')],
      },
    });
    attackWith(engine, game, 'p1', 'Ogre', 'Éclaireur');

    engine.timeout(game);

    expect(game.pendingChoices).toEqual([]);
    expect(game.phase).toBe('end');
  });
});
