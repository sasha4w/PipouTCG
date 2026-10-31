import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

const engine = createEngine();

describe('dégâts divisés à durée limitée', () => {
  it('Jeune Teros : divise les dégâts par 2 pendant 2 tours adverses, puis plus', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Jeune Teros')],
        monsters: [realCard('Bébé Teros')],
        recycleEnergy: 1,
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Bébé Teros').instanceId,
        paymentHandIndices: [],
      }).error,
    ).toBeUndefined();
    const teros = () => monsterNamed(game, 'p1', 'Jeune Teros');
    expect(teros().damageReduction).toBe(2);

    passTurn(engine, game); // tour adverse 1 : protégé
    passTurn(engine, game); // début de mon tour : 1 tour restant
    expect(teros().damageReduction).toBe(2);

    passTurn(engine, game); // tour adverse 2 : protégé
    passTurn(engine, game); // début de mon tour : fini
    expect(teros().damageReduction).toBeUndefined();
    expect(teros().perm.damageReduction).toBeUndefined();
  });

  it('Écaille de Dragon : réduction de 2 tours donnée au porteur à la pose', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Écaille de Dragon')],
        monsters: [monsterCard('Porteur', { hp: 1000 })],
      },
    });
    const porteur = monsterNamed(game, 'p1', 'Porteur');
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: porteur.instanceId,
      }).error,
    ).toBeUndefined();
    expect(porteur.damageReduction).toBe(2);
    expect(porteur.reductionTurns).toBe(2);

    passTurn(engine, game);
    passTurn(engine, game);
    passTurn(engine, game);
    passTurn(engine, game);
    expect(porteur.damageReduction).toBeUndefined();
  });
});
