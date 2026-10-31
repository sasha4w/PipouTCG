import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { monsterNamed, scenario } from '../testing/scenario';
import { AiPlayer } from './ai-player';
import type { AiProfile } from './ai-player';
import { listCandidates } from './candidate-actions';
import { LEVEL_BRAINS, createLevelAi } from './level-brains';
import { STRONGEST } from './planner';
import type { ThinkingProfile } from './planner';

const engine = createEngine();

/** Lame peut tuer Moucheron (dernière Prime) : le meilleur coup est connu. */
function winningAttack() {
  return scenario({
    turn: 'p2',
    phase: 'battle',
    p1: {
      monsters: [
        monsterCard('Colosse', { atk: 50, hp: 5000 }),
        monsterCard('Moucheron', { atk: 0, hp: 100 }),
      ],
    },
    p2: {
      primes: 1,
      monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
    },
  });
}

const level = (n: 1 | 2 | 3 | 4 | 5): AiProfile => ({
  archetype: 'pipou',
  level: n,
});

describe('LEVEL_BRAINS', () => {
  it('niveaux 1 et 2 gloutons qui se trompent, 3 à 5 qui planifient', () => {
    expect(LEVEL_BRAINS[1]).toEqual({ thinking: 'greedy', mistakeRate: 0.25 });
    expect(LEVEL_BRAINS[2]).toEqual({ thinking: 'greedy', mistakeRate: 0.1 });
    const planned = ([3, 4, 5] as const).map(
      (n) => LEVEL_BRAINS[n].thinking as ThinkingProfile,
    );
    for (const n of [3, 4, 5] as const)
      expect(LEVEL_BRAINS[n].mistakeRate).toBe(0);
    for (const p of planned) expect(p.timeLimitMs).toBe(50);
    expect(planned[0].beamWidth).toBeLessThan(planned[1].beamWidth);
    expect(planned[1].beamWidth).toBeLessThan(planned[2].beamWidth);
    expect(planned[0].depth).toBeLessThan(planned[1].depth);
    expect(planned[1].depth).toBeLessThan(planned[2].depth);
    expect(planned[2]).toMatchObject({
      beamWidth: STRONGEST.beamWidth,
      depth: STRONGEST.depth,
      budget: STRONGEST.budget,
    });
  });
});

describe('createLevelAi', () => {
  it('niveau 1 : erreur forcée, mais crédible : la victoire n’est pas ratée', () => {
    const game = winningAttack();
    const first = listCandidates(game, 'p2').find(
      (a) => !engine.dispatch(structuredClone(game), 'p2', a).error,
    );
    const best = {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', 'Lame').instanceId,
      targetInstanceId: monsterNamed(game, 'p1', 'Moucheron').instanceId,
    };
    // L'ancienne erreur jouait ce premier coup valide, qui rate la victoire
    expect(first).not.toEqual(best);
    expect(
      createLevelAi(engine, 1, () => 0).chooseAction(game, 'p2', level(1)),
    ).toEqual(best);
  });

  it('taux 0 par défaut : jamais de coup au hasard, même au niveau 1', () => {
    const game = winningAttack();
    expect(
      new AiPlayer(engine, () => 0).chooseAction(game, 'p2', level(1)),
    ).toEqual({
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', 'Lame').instanceId,
      targetInstanceId: monsterNamed(game, 'p1', 'Moucheron').instanceId,
    });
  });

  it('niveau 3 : même coup que le planificateur de son profil', () => {
    const game = winningAttack();
    expect(
      createLevelAi(engine, 3, () => 0).chooseAction(game, 'p2', level(3)),
    ).toEqual(
      new AiPlayer(engine, () => 0, LEVEL_BRAINS[3].thinking).chooseAction(
        game,
        'p2',
        level(3),
      ),
    );
  });
});
