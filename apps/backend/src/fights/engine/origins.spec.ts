import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import type { CardEffect } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { listCandidates } from '../ai/candidate-actions';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { monsterNamed, scenario, seatState } from '../testing/scenario';

const engine = createEngine();

const origines = () =>
  monsterCard('Origines', {
    archetype: 'dragon',
    cost: 0,
    atk: 1500,
    hp: 4000,
    effects: [
      effect(EffectTrigger.PASSIVE, [
        act(ActionType.SUMMON_IF_ALL_ELEMENTS, EffectTarget.SELF),
      ]),
      effect(EffectTrigger.ON_SUMMON, [
        act(ActionType.COPY_GRAVEYARD_EFFECTS, EffectTarget.PLAYER),
      ]),
    ],
  });

const adult = (element: string, effects: CardEffect[] = []) =>
  monsterCard(`Adulte ${element}`, {
    stage: 'adult',
    element,
    lineage: element,
    archetype: 'dragon',
    effects,
  } as Partial<Card>);

const doubleAttack = effect(EffectTrigger.PASSIVE, [
  act(ActionType.SET_ATTACKS_PER_TURN, EffectTarget.SELF, { value: 2 }),
]);
const blast = effect(EffectTrigger.ON_SUMMON, [
  act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 400 }),
]);

function withGraveyard(graveyard: Card[], hand: Card[] = [origines()]) {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand, graveyard },
    p2: { monsters: [monsterCard('Cible', { atk: 0, hp: 1000 })] },
  });
}

const fourElements = () => [
  adult('earth'),
  adult('fire', [blast]),
  adult('water'),
  adult('wind', [doubleAttack]),
];

const summon = (game: ReturnType<typeof withGraveyard>) =>
  engine.dispatch(game, 'p1', {
    type: 'summon',
    handIndex: 0,
    zoneIndex: 0,
    paymentHandIndices: [],
  });

const pick = (game: ReturnType<typeof withGraveyard>, name: string) => {
  const choice = game.pendingChoices[0];
  const c = choice.candidates.find((x) => x.baseCard.name === name)!;
  return engine.dispatch(game, 'p1', {
    type: 'pick_cards',
    instanceIds: [c.instanceId],
  });
};

describe('Drakon des Origines', () => {
  it('refuse sans les 4 éléments au cimetière', () => {
    const game = withGraveyard(fourElements().slice(0, 3));
    expect(summon(game).error).toBe(
      'Il faut un Adulte ou un Ancestral de chaque élément au cimetière',
    );
  });

  it("refuse si l'élément manquant n'a qu'un Bébé", () => {
    const game = withGraveyard([
      ...fourElements().slice(0, 3),
      monsterCard('Bébé wind', {
        stage: 'baby',
        element: 'wind',
      }),
    ]);
    expect(summon(game).error).toBeDefined();
  });

  it('invoque avec les 4 éléments, puis propose de choisir un Adulte', () => {
    const game = withGraveyard(fourElements());
    expect(summon(game).error).toBeUndefined();
    expect(game.pendingChoices[0]).toMatchObject({
      resolution: 'copy_effects',
    });
    expect(game.pendingChoices[0].candidates).toHaveLength(4);
  });

  it('copie un passif (2 attaques par tour)', () => {
    const game = withGraveyard(fourElements());
    summon(game);
    expect(pick(game, 'Adulte wind').error).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Origines').attacksPerTurn).toBe(2);
    expect(seatState(game, 'p1').graveyard).toHaveLength(4);
  });

  it("résout aussitôt l'effet d'arrivée copié", () => {
    const game = withGraveyard(fourElements());
    summon(game);
    pick(game, 'Adulte fire');
    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(600);
  });

  it('en partant au cimetière, il redevient la carte d’origine', () => {
    const sacrifice = ephemeralCard('Sacrifice', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.TARGET_ALLY),
      ]),
    ]);
    const game = withGraveyard(fourElements(), [origines(), sacrifice]);
    summon(game);
    pick(game, 'Adulte wind');
    const id = monsterNamed(game, 'p1', 'Origines').instanceId;
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: id,
      }).error,
    ).toBeUndefined();
    const card = seatState(game, 'p1').graveyard.find(
      (c) => c.baseCard.name === 'Origines',
    )!;
    expect(card.baseCard.effects).toHaveLength(2);
  });

  it('IA : pas d’invocation sans les 4 éléments ; choix de copie accepté', () => {
    const without = withGraveyard(fourElements().slice(0, 3));
    expect(
      listCandidates(without, 'p1').some(
        (a) => a.type === 'summon' && a.handIndex === 0,
      ),
    ).toBe(false);

    const game = withGraveyard(fourElements());
    summon(game);
    const choice = listCandidates(game, 'p1').find(
      (a) => a.type === 'pick_cards',
    );
    expect(choice).toBeDefined();
    expect(engine.dispatch(game, 'p1', choice!).error).toBeUndefined();
  });
});
