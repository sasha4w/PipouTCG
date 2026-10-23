import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { monsterNamed, scenario } from '../testing/scenario';

const engine = createEngine();
const ADULTS = [
  'Adulte Teros',
  'Adulte Feros',
  'Adulte Ackos',
  'Adulte Tempestu',
];

describe("vraies cartes de l'extension Drakon", () => {
  it('Ancestral Feros évolue sur Adulte Feros et inflige 600 à tous les ennemis', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [realCard('Ancestral Feros')],
        recycleEnergy: 1,
        monsters: [realCard('Adulte Feros')],
      },
      p2: { monsters: [monsterCard('Cible', { atk: 0, hp: 1000 })] },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Adulte Feros').instanceId,
        paymentHandIndices: [],
      }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(400);
  });

  const withGraveyard = (names: string[]) =>
    scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [realCard('Drakon des Origines')],
        recycleEnergy: 4,
        graveyard: names.map(realCard),
      },
    });
  const summon = (game: ReturnType<typeof withGraveyard>) =>
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });

  it('refusé avec 3 Adultes au cimetière', () => {
    expect(summon(withGraveyard(ADULTS.slice(0, 3))).error).toBeDefined();
  });

  it('invoqué avec les 4 Adultes, copie Adulte Tempestu, immunisé', () => {
    const game = withGraveyard(ADULTS);
    expect(summon(game).error).toBeUndefined();
    const choice = game.pendingChoices[0];
    const tempestu = choice.candidates.find(
      (c) => c.baseCard.name === 'Adulte Tempestu',
    )!;
    expect(
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [tempestu.instanceId],
      }).error,
    ).toBeUndefined();
    const origines = monsterNamed(game, 'p1', 'Drakon des Origines');
    expect(origines.attacksPerTurn).toBe(2);
    expect(origines.isImmuneToDebuffs).toBe(true);
  });
});
