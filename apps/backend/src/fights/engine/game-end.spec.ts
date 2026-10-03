import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario, monsterNamed, P1_ID } from '../testing/scenario';

describe('GameEngine — fin de partie', () => {
  const engine = createEngine();

  it('double K.O. qui vide les deux compteurs de Primes : match nul', () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        primes: 1,
        monsters: [monsterCard('Ogre', { atk: 500, hp: 500 })],
      },
      p2: {
        primes: 1,
        monsters: [monsterCard('Troll', { atk: 500, hp: 500 })],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Troll').instanceId,
    });

    expect(game.phase).toBe('finished');
    expect(game.winner).toBeUndefined();
    expect(game.endReason).toBe('double_ko');
  });

  it("la Prime d'un compteur de tour expiré peut faire gagner la partie", () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p1: { primes: 1 },
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

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('primes_depleted');
  });
});
