import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import {
  scenario,
  monsterNamed,
  handNames,
  P1_ID,
  P2_ID,
} from '../testing/scenario';

describe('GameEngine — actions de base', () => {
  const engine = createEngine();

  it('invoque un monstre de coût 0 sur une zone libre', () => {
    const game = scenario({ p1: { hand: [monsterCard('Gobelin')] } });

    const result = engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 1,
      paymentHandIndices: [],
    });

    expect(result).toEqual({});
    expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe('Gobelin');
    expect(game.player1.hand).toHaveLength(0);
  });

  it('refuse une action hors de son tour', () => {
    const game = scenario({ p2: { hand: [monsterCard('Gobelin')] } });

    expect(
      engine.dispatch(game, 'p2', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
      }),
    ).toEqual({ error: "Ce n'est pas ton tour" });
  });

  it("ATK contre ATK : l'attaquant gagne une Prime, le propriétaire du détruit pioche", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: {
        monsters: [monsterCard('Lutin', { atk: 100, hp: 300 })],
        deck: [monsterCard('Pioché')],
      },
    });
    const ogre = monsterNamed(game, 'p1', 'Ogre');
    const lutin = monsterNamed(game, 'p2', 'Lutin');

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: ogre.instanceId,
      targetInstanceId: lutin.instanceId,
    });

    expect(game.player2.monsterZones[0]).toBeNull();
    expect(ogre.currentHp).toBe(800);
    expect(game.player1.primes).toBe(5);
    expect(handNames(game, 'p2')).toEqual(['Pioché']);
  });

  it("attaque directe : +1 Prime pour l'attaquant, le défenseur pioche", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre')] },
      p2: { deck: [monsterCard('Pioché')] },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      direct: true,
    });

    expect(game.player1.primes).toBe(5);
    expect(handNames(game, 'p2')).toEqual(['Pioché']);
  });

  it('fin de tour : main → battle → end, puis tour adverse qui pioche', () => {
    const game = scenario({ p2: { deck: [monsterCard('Carte du tour')] } });

    for (let i = 0; i < 3; i++) {
      expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({});
    }

    expect(game.currentTurnUserId).toBe(P2_ID);
    expect(game.turnNumber).toBe(3);
    expect(game.phase).toBe('main');
    expect(handNames(game, 'p2')).toEqual(['Carte du tour']);
  });

  it('termine la partie quand un joueur a récupéré toutes ses Primes', () => {
    const game = scenario({
      phase: 'battle',
      p1: { primes: 1, monsters: [monsterCard('Ogre')] },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      direct: true,
    });

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('primes_depleted');
  });

  it('refuse toute action sur une partie terminée', () => {
    const game = scenario();
    game.phase = 'finished';

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({
      error: 'La partie est terminée',
    });
  });
});
