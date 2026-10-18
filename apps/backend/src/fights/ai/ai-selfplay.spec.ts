import { randomUUID } from 'node:crypto';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { generateDeck } from '../../adventure/deck-generator';
import { LAUNCH_SIGNATURES } from '../../adventure/signatures';
import { createGameState } from '../helpers/game-factory';
import type { CardInstance } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { allRealCards } from '../testing/real-cards';
import { AiPlayer, aiMustAct } from './ai-player';

jest.setTimeout(60_000);

const ALL = allRealCards();
const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];
const MAX_ACTIONS = 2000;
const LEVEL = 3;

/** mulberry32 : générateur déterministe. */
function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deck d'IA niveau 3, mélangé avec `random` (le moteur ne mélange pas : fixedRng). */
function deckFor(
  archetype: AdventureArchetype,
  ownerId: number,
  random: () => number,
): CardInstance[] {
  const set = ALL.filter((c) => c.archetype === archetype);
  const byId = new Map<number, Card>(set.map((c) => [c.id, c]));
  const entries = generateDeck(
    set,
    LEVEL,
    LAUNCH_SIGNATURES[archetype][LEVEL - 1],
    random,
  );
  const cards = entries.flatMap((e) =>
    Array.from({ length: e.quantity }, () => ({
      instanceId: randomUUID(),
      baseCard: byId.get(e.cardId)!,
      ownerId,
    })),
  );
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const PAIRS = ARCHETYPES.flatMap((a) => ARCHETYPES.map((b) => [a, b] as const));

describe('IA contre IA (moteur réel)', () => {
  let randomSpy: jest.SpyInstance;
  afterEach(() => randomSpy?.mockRestore());

  it.each(PAIRS)('%s contre %s : la partie se termine', (a, b) => {
    const random = seeded(42);
    // PickService mélange avec Math.random : on le fige aussi
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(seeded(7));
    const engine = createEngine(fixedRng());
    const ai = new AiPlayer(engine, random);
    const game = createGameState(
      1,
      { userId: 1, username: 'IA 1', socketId: 's1' },
      { userId: 2, username: 'IA 2', socketId: 's2' },
    );
    engine.setupDeck(game, 'p1', deckFor(a, 1, random));
    engine.setupDeck(game, 'p2', deckFor(b, 2, random));

    const seats: {
      seat: Seat;
      userId: number;
      archetype: AdventureArchetype;
    }[] = [
      { seat: 'p1', userId: 1, archetype: a },
      { seat: 'p2', userId: 2, archetype: b },
    ];
    const refused: string[] = [];
    let actions = 0;
    const started = Date.now();
    while (game.phase !== 'finished' && actions < MAX_ACTIONS) {
      const actor = seats.find((s) => aiMustAct(game, s.userId));
      if (!actor)
        throw new Error(`Personne ne doit agir (phase ${game.phase})`);
      const action = ai.chooseAction(game, actor.seat, {
        archetype: actor.archetype,
        level: LEVEL,
      });
      const result = engine.dispatch(game, actor.seat, action);
      if (result.error)
        refused.push(`${JSON.stringify(action)} → ${result.error}`);
      actions++;
    }

    console.log(
      `${a} vs ${b} : ${actions} actions, tour ${game.turnNumber}, ` +
        `vainqueur ${game.winner ?? 'aucun'} (${game.endReason}), ` +
        `${Date.now() - started} ms`,
    );
    expect(refused).toEqual([]);
    expect(game.phase).toBe('finished');
    expect(actions).toBeLessThan(MAX_ACTIONS);
  });
});
