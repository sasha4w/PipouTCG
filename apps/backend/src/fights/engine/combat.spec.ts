import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, monsterCard } from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  monsterNamed,
  scenario,
} from '../testing/scenario';

describe('GameEngine — combat', () => {
  const engine = createEngine();

  /** Monstre en Garde qui divise par 2 les dégâts reçus. */
  const rempart = () => ({
    card: monsterCard('Rempart', { atk: 0, hp: 900 }),
    mode: 'guard' as const,
    patch: { damageReduction: 2 },
  });

  it('Perçant ignore la réduction de dégâts et rapporte une Prime sur une Garde', () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        monsters: [
          {
            card: monsterCard('Delta', { atk: 1000, hp: 800 }),
            patch: { hasPiercing: true },
          },
        ],
      },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Delta', 'Rempart');

    expect(graveyardNames(game, 'p2')).toContain('Rempart');
    expect(game.player1.primes).toBe(5);
  });

  it("sans Perçant, la réduction de dégâts s'applique", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Brute', { atk: 1000, hp: 800 })] },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Brute', 'Rempart');

    expect(monsterNamed(game, 'p2', 'Rempart').currentHp).toBe(400);
    expect(game.player1.primes).toBe(6);
  });

  it("l'ATK du défenseur est lue après ON_DEFEND, bonus temporaire compris", () => {
    const herisson = monsterCard('Hérisson', {
      atk: 100,
      hp: 2000,
      effects: [
        effect(EffectTrigger.ON_DEFEND, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.SELF, { value: 500 }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Imprudent', { atk: 100, hp: 550 })] },
      p2: { monsters: [herisson] },
    });

    attackWith(engine, game, 'p1', 'Imprudent', 'Hérisson');

    expect(graveyardNames(game, 'p1')).toContain('Imprudent');
  });

  it("si ON_ATTACK détruit la cible, l'attaque se perd sans erreur", () => {
    const artilleur = monsterCard('Artilleur', {
      atk: 100,
      hp: 500,
      effects: [
        effect(EffectTrigger.ON_ATTACK, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
            value: 1000,
          }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [artilleur] },
      p2: { monsters: [monsterCard('Lutin', { atk: 400, hp: 300 })] },
    });

    expect(attackWith(engine, game, 'p1', 'Artilleur', 'Lutin')).toEqual({});
    expect(graveyardNames(game, 'p2')).toContain('Lutin');
    expect(monsterNamed(game, 'p1', 'Artilleur').currentHp).toBe(500);
    expect(game.player1.primes).toBe(6);
  });
});
