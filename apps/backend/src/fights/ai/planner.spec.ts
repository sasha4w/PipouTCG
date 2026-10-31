import type { GameAction } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { P1_ID, P2_ID, monsterNamed, scenario } from '../testing/scenario';
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
  scoreAfterChoice,
  stateSignature,
} from './planner';
import { seeded } from './tournament';

const engine = createEngine();
const WITH_RIPOSTE = { ...STRONGEST, ripostes: 2 };
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

  it('plafond de temps dépassé : tous les premiers coups sont quand même comparés', () => {
    // Lame tue Moucheron (dernière Prime) : ce n'est pas le premier candidat
    const game = scenario({
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
    const first = listCandidates(game, 'p2')[0];
    const winning = {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', 'Lame').instanceId,
      targetInstanceId: monsterNamed(game, 'p1', 'Moucheron').instanceId,
    };
    expect(first).not.toEqual(winning);
    // L'horloge saute de 1 s à chaque lecture : échéance dépassée dès la 1re simulation
    let t = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (t += 1000));
    const plan = planTurn(
      engine,
      game,
      'p2',
      pipou,
      { ...STRONGEST, timeLimitMs: 1 },
      seeded(1),
      { used: 0 },
    );
    jest.restoreAllMocks();
    expect(plan!.actions[0]).toEqual(winning);
  });

  it('plafond de temps à 0 : l’IA joue quand même un coup valide', () => {
    const game = lonelyRecruit();
    const action = new AiPlayer(engine, seeded(1), {
      ...STRONGEST,
      timeLimitMs: 0,
    }).chooseAction(game, 'p1', pipou);
    expect(engine.dispatch(game, 'p1', action).error).toBeUndefined();
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

  it('une suite ne repasse jamais par un état déjà visité', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        monsters: [
          monsterCard('Alpha', { atk: 200, hp: 600 }),
          monsterCard('Beta', { atk: 150, hp: 500 }),
        ],
      },
      p2: { monsters: [monsterCard('Brute', { atk: 500, hp: 900 })] },
    });
    for (let s = 1; s <= 5; s++) {
      const plan = planTurn(engine, game, 'p1', pipou, STRONGEST, seeded(s), {
        used: 0,
      })!;
      const seen = [stateSignature(game, 'p1'), ...plan.expected];
      expect(new Set(seen).size).toBe(seen.length);
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
      riposte(engine, leaf, 'p1', pipou, WITH_RIPOSTE, seeded(1), { used: 0 }),
    ).toBe(-Infinity);
  });

  it('partie finie : pas de simulation', () => {
    const leaf = scenario({ phase: 'finished' });
    leaf.winner = P1_ID;
    const counter = { used: 0 };
    expect(
      riposte(engine, leaf, 'p1', pipou, WITH_RIPOSTE, seeded(1), counter),
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
  it('finit son tour sans tourner en rond (changements de mode)', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        monsters: [
          monsterCard('Alpha', { atk: 200, hp: 600 }),
          monsterCard('Beta', { atk: 150, hp: 500 }),
        ],
      },
      p2: { monsters: [monsterCard('Brute', { atk: 500, hp: 900 })] },
    });
    const ai = new AiPlayer(engine, seeded(3), STRONGEST);
    let actions = 0;
    while (game.currentTurnUserId === P1_ID && game.phase !== 'finished') {
      if (++actions > 30) break;
      const action = ai.chooseAction(game, 'p1', pipou);
      expect(engine.dispatch(game, 'p1', action).error).toBeUndefined();
    }
    expect(actions).toBeLessThanOrEqual(30);
  });

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

describe('fins de suite', () => {
  it("un choix laissé à l'adversaire termine la suite", () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [
          ephemeralCard('Pillage', [
            effect(EffectTrigger.ON_PLAY, [
              act(ActionType.DISCARD, EffectTarget.OPPONENT, { value: 1 }),
            ]),
          ]),
          monsterCard('Recrue'),
        ],
      },
      p2: { hand: [monsterCard('A'), monsterCard('B')] },
    });
    const played = structuredClone(game);
    expect(
      engine.dispatch(played, 'p1', { type: 'play_support', handIndex: 0 })
        .error,
    ).toBeUndefined();
    // Le choix de défausse revient à p2 : plus aucun coup pour p1
    expect(played.pendingChoices[0]?.forUserId).toBe(P2_ID);
    expect(
      planTurn(engine, played, 'p1', pipou, STRONGEST, seeded(1), { used: 0 }),
    ).toBeNull();
    // Dans une recherche, ce coup ne peut donc être que le dernier de sa suite
    const plan = planTurn(engine, game, 'p1', pipou, STRONGEST, seeded(1), {
      used: 0,
    })!;
    const at = plan.actions.findIndex(
      (a) => a.type === 'play_support' && a.handIndex === 0,
    );
    if (at !== -1) expect(at).toBe(plan.actions.length - 1);
  });

  it('un Jeune jouable sur le Bébé en jeu est bien joué', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        recycleEnergy: 1,
        hand: [
          monsterCard('Jeune Feros', {
            stage: 'young',
            lineage: 'feros',
            atk: 300,
            hp: 800,
            cost: 1,
          }),
        ],
        monsters: [
          monsterCard('Bébé Feros', {
            stage: 'baby',
            lineage: 'feros',
            atk: 100,
            hp: 300,
          }),
        ],
      },
    });
    const plan = planTurn(engine, game, 'p1', dragon, STRONGEST, seeded(1), {
      used: 0,
    })!;
    expect(types(plan.actions)).toContain('evolve');
  });

  it('un choix à faire est noté avec son meilleur choix, pas comme un état figé', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p2: { deck: [monsterCard('Petit'), monsterCard('Grand', { atk: 900 })] },
    });
    game.pendingChoices.push({
      forUserId: P2_ID,
      candidates: game.player2.deck.map((c) => ({
        instanceId: c.instanceId,
        baseCard: c.baseCard,
        source: 'deck' as const,
      })),
      count: 1,
      prompt: 'Choisis une carte',
    });
    const score = (s: GameState) => evaluate(s, 'p2', 'pipou');
    const best = Math.max(
      ...listCandidates(game, 'p2')
        .filter((a) => a.type === 'pick_cards')
        .map((a) => {
          const next = structuredClone(game);
          engine.dispatch(next, 'p2', a);
          return score(next);
        }),
    );

    expect(scoreAfterChoice(engine, game, 'p2', score)).toBe(best);
    // Sans choix pour lui : le score de l'état, tel quel
    expect(
      scoreAfterChoice(engine, game, 'p1', (s) => evaluate(s, 'p1', 'pipou')),
    ).toBe(evaluate(game, 'p1', 'pipou'));
  });
});
