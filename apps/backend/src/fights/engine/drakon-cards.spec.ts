import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  handNames,
  monsterNamed,
  passTurn,
  scenario,
} from '../testing/scenario';

describe('cartes Drakon', () => {
  const engine = createEngine();

  it('Bébé → Jeune Feros, puis délai avant l’Adulte', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Jeune Feros'), realCard('Adulte Feros')],
        monsters: [realCard('Bébé Feros')],
        recycleEnergy: 3,
      },
      p2: { monsters: [monsterCard('Cible', { hp: 3000 })] },
    });
    const evolveTo = (target: string) =>
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', target).instanceId,
        paymentHandIndices: [],
      });
    expect(evolveTo('Bébé Feros')).toEqual({});
    expect(evolveTo('Jeune Feros').error).toBe(
      "Jeune Feros doit attendre un tour avant d'évoluer",
    );
  });

  it('Adulte Tempestu renvoie le monstre adverse le plus fort', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Adulte Tempestu')],
        monsters: [realCard('Jeune Tempestu')],
        recycleEnergy: 3,
      },
      p2: {
        monsters: [
          monsterCard('Faible', { atk: 100 }),
          monsterCard('Fort', { atk: 900 }),
        ],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'evolve',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Jeune Tempestu').instanceId,
      paymentHandIndices: [],
    });
    expect(handNames(game, 'p2')).toContain('Fort');
  });

  it('Œuf Céleste : éclot en Adulte après 4 tours', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Œuf Céleste')],
        deck: [
          monsterCard('A'),
          monsterCard('B'),
          monsterCard('C'),
          monsterCard('D'),
          monsterCard('E'),
          realCard('Adulte Teros'),
        ],
        recycleEnergy: 3,
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });
    for (let i = 0; i < 8 && game.pendingChoices.length === 0; i++)
      passTurn(engine, game);
    expect(
      game.pendingChoices[0]?.candidates.map((c) => c.baseCard.name),
    ).toEqual(['Adulte Teros']);
  });

  it('Œuf de la Genèse : joker pour un Jeune Ackos', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Jeune Ackos')],
        monsters: [realCard('Œuf de la Genèse')],
        recycleEnergy: 3,
      },
    });
    engine.settle(game);
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Œuf de la Genèse')
          .instanceId,
        paymentHandIndices: [],
      }),
    ).toEqual({});
  });
});
