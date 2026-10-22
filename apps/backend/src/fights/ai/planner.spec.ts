import type { GameAction } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { P1_ID, scenario } from '../testing/scenario';
import { AiPlayer } from './ai-player';
import type { AiProfile } from './ai-player';
import { listCandidates } from './candidate-actions';
import { evaluate } from './evaluate';
import {
  STRONGEST,
  actionKey,
  countingEngine,
  inferArchetype,
  planTurn,
  riposte,
} from './planner';
import { seeded } from './tournament';

const engine = createEngine();
const dragon: AiProfile = { archetype: 'dragon', level: 3 };
const pipou: AiProfile = { archetype: 'pipou', level: 3 };

/** Adulte coincé en main, Bébé au cimetière, zone libre. */
function stuckAdult(): GameState {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: {
      hand: [
        monsterCard('Adulte Feros', {
          stage: 'adult',
          lineage: 'feros',
          atk: 700,
          hp: 900,
        }),
      ],
      graveyard: [
        monsterCard('Bébé Feros', {
          stage: 'baby',
          lineage: 'feros',
          atk: 200,
        }),
      ],
    },
  });
}

/** Une recrue qui ne survit qu'en Garde ; sans elle, attaque directe adverse. */
function lonelyRecruit(): GameState {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand: [monsterCard('Recrue', { atk: 100, hp: 400 })] },
    p2: { monsters: [monsterCard('Brute', { atk: 500, hp: 900 })] },
  });
}

const types = (actions: GameAction[]) => actions.map((a) => a.type);

describe('planTurn', () => {
  it('Transformer puis choisir le Bébé, sans cas spécial', () => {
    const plan = planTurn(
      engine,
      stuckAdult(),
      'p1',
      dragon,
      STRONGEST,
      seeded(1),
      { used: 0 },
    );
    expect(types(plan!.actions).slice(0, 2)).toEqual([
      'transform',
      'pick_cards',
    ]);
    const ai = new AiPlayer(engine, () => 0.99, STRONGEST);
    expect(ai.chooseAction(stuckAdult(), 'p1', dragon)).toEqual({
      type: 'transform',
      handIndex: 0,
    });
  });

  it('invocation puis Garde', () => {
    const plan = planTurn(
      engine,
      lonelyRecruit(),
      'p1',
      pipou,
      STRONGEST,
      seeded(1),
      { used: 0 },
    )!;
    expect(plan.actions[0].type).toBe('summon');
    const beforeEnd = plan.actions.slice(
      0,
      plan.actions.findIndex((a) => a.type === 'end_phase'),
    );
    expect(beforeEnd).toContainEqual(
      expect.objectContaining({ type: 'change_mode', mode: 'guard' }),
    );
  });

  it('budget respecté, plan jouable', () => {
    const game = lonelyRecruit();
    const counter = { used: 0 };
    const plan = planTurn(
      engine,
      game,
      'p1',
      pipou,
      { ...STRONGEST, ripostes: 0, budget: 40 },
      seeded(1),
      counter,
    )!;
    expect(counter.used).toBeLessThanOrEqual(40);
    // Rejoué dans la vraie partie : chaque coup se retrouve par sa clé
    const real = structuredClone(game);
    for (const key of plan.keys) {
      const action = listCandidates(real, 'p1').find(
        (a) => actionKey(real, a) === key,
      );
      expect(action).toBeDefined();
      expect(engine.dispatch(real, 'p1', action!).error).toBeUndefined();
    }
  });

  it('déterministe', () => {
    const game = lonelyRecruit();
    const run = () =>
      planTurn(engine, game, 'p1', pipou, STRONGEST, seeded(5), {
        used: 0,
      })!.keys;
    expect(run()).toEqual(run());
  });
});

describe('riposte', () => {
  it('inferArchetype : majorité dragon', () => {
    const card = (archetype: 'dragon' | 'pipou') =>
      monsterCard(`Carte ${archetype}`, { archetype });
    const game = scenario({
      p2: {
        hand: [card('dragon'), card('pipou')],
        deck: [
          ...Array.from({ length: 5 }, () => card('dragon')),
          card('pipou'),
        ],
      },
    });
    expect(inferArchetype(game.player2)).toBe('dragon');
  });

  it('voit la Prime gagnante adverse', () => {
    const leaf = scenario({
      turn: 'p1',
      phase: 'end',
      p2: { primes: 1, monsters: [monsterCard('Brute', { atk: 500 })] },
    });
    expect(evaluate(leaf, 'p1', 'pipou')).toBeGreaterThan(-Infinity);
    expect(
      riposte(engine, leaf, 'p1', pipou, STRONGEST, seeded(1), { used: 0 }),
    ).toBe(-Infinity);
  });

  it('partie finie : pas de simulation', () => {
    const leaf = scenario({ phase: 'finished' });
    leaf.winner = P1_ID;
    const counter = { used: 0 };
    expect(
      riposte(engine, leaf, 'p1', pipou, STRONGEST, seeded(1), counter),
    ).toBe(Infinity);
    expect(counter.used).toBe(0);
  });

  it('le plan évite une fin de tour perdante', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { monsters: [monsterCard('Fragile', { atk: 100, hp: 300 })] },
      p2: {
        primes: 1,
        monsters: [monsterCard('Brute', { atk: 500, hp: 900 })],
      },
    });
    const plan = planTurn(engine, game, 'p1', pipou, STRONGEST, seeded(1), {
      used: 0,
    })!;
    const fragile = game.player1.monsterZones[0]!;
    const modes = plan.actions.filter(
      (a) => a.type === 'change_mode' && a.instanceId === fragile.instanceId,
    );
    expect(modes.at(-1)).toMatchObject({ mode: 'guard' });
  });
});

describe('AiPlayer qui planifie', () => {
  it('suit son plan sans rechercher à nouveau, replanifie si la main change', () => {
    const counter = { used: 0 };
    const ai = new AiPlayer(
      countingEngine(engine, counter),
      seeded(2),
      STRONGEST,
    );
    const game = stuckAdult();

    const first = ai.chooseDetailed(game, 'p1', dragon).action;
    const planning = counter.used;
    expect(engine.dispatch(game, 'p1', first).error).toBeUndefined();

    counter.used = 0;
    const second = ai.chooseDetailed(game, 'p1', dragon).action;
    const following = counter.used;
    expect(following).toBeLessThan(planning);
    expect(engine.dispatch(game, 'p1', second).error).toBeUndefined();

    // Une carte arrive en main : l'état réel n'est plus celui prévu
    game.player1.hand.push(
      structuredClone(game.player1.hand[0] ?? game.player1.graveyard[0]),
    );
    game.player1.hand.at(-1)!.instanceId = 'imprévue';
    counter.used = 0;
    ai.chooseDetailed(game, 'p1', dragon);
    expect(counter.used).toBeGreaterThan(following);
  });
});
