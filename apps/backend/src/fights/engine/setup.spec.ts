import type { CardInstance } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { monsterCard } from '../testing/cards';
import {
  handNames,
  instanceOf,
  waitingScenario,
  P1_ID,
  P2_ID,
} from '../testing/scenario';

const deckOf = (prefix: string, ownerId: number): CardInstance[] =>
  Array.from({ length: 36 }, (_, i) =>
    instanceOf(monsterCard(`${prefix}${i}`), ownerId),
  );
const names = (cards: CardInstance[]) => cards.map((c) => c.baseCard.name);
const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

function inMulligan(p1Starts = true) {
  const engine = createEngine(fixedRng({ p1Starts }));
  const game = waitingScenario();
  engine.setupDeck(game, 'p1', deckOf('A', P1_ID));
  engine.setupDeck(game, 'p2', deckOf('B', P2_ID));
  return { engine, game };
}

describe('GameEngine — mise en place', () => {
  it("installe Primes, main et deck dans l'ordre du mélange, puis passe au mulligan", () => {
    const engine = createEngine(fixedRng({ p1Starts: false }));
    const game = waitingScenario();

    expect(engine.setupDeck(game, 'p1', deckOf('A', P1_ID))).toEqual({});
    expect(game.phase).toBe('waiting');
    engine.setupDeck(game, 'p2', deckOf('B', P2_ID));

    expect(names(game.player1.primeDeck)).toEqual(range('A', 0, 5));
    expect(game.player1.primes).toBe(6);
    expect(handNames(game, 'p1')).toEqual(range('A', 6, 10));
    expect(game.player1.deck).toHaveLength(25);
    expect(game.phase).toBe('mulligan');
    expect(game.currentTurnUserId).toBe(P2_ID);
  });

  it('refuse un second deck pour le même joueur', () => {
    const engine = createEngine();
    const game = waitingScenario();
    engine.setupDeck(game, 'p1', deckOf('A', P1_ID));

    expect(engine.setupDeck(game, 'p1', deckOf('A', P1_ID))).toEqual({
      error: 'Deck déjà soumis',
    });
  });

  it('pendant le mulligan, seules les décisions de mulligan sont acceptées', () => {
    const { engine, game } = inMulligan();

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({
      error: 'Phase de mulligan en cours',
    });
  });

  it('quand les deux gardent leur main, le premier joueur commence et pioche', () => {
    const { engine, game } = inMulligan(true);

    engine.dispatch(game, 'p2', { type: 'mulligan', redraw: false });
    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: false });

    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(1);
    expect(game.currentTurnUserId).toBe(P1_ID);
    expect(handNames(game, 'p1')).toEqual(range('A', 6, 11));
    expect(handNames(game, 'p2')).toEqual(range('B', 6, 10));
  });

  it('un mulligan remet la main dans le deck et repioche 5 cartes', () => {
    const { engine, game } = inMulligan();

    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: true });

    expect(handNames(game, 'p1')).toEqual(range('A', 11, 15));
    expect(game.player1.deck).toHaveLength(25);
    expect(game.player1.mulliganDone).toBe(true);
  });

  it('une seule décision de mulligan par joueur', () => {
    const { engine, game } = inMulligan();
    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: false });

    expect(
      engine.dispatch(game, 'p1', { type: 'mulligan', redraw: true }),
    ).toEqual({ error: 'Mulligan déjà décidé' });
  });

  it('un timeout pendant le mulligan garde les mains et lance la partie', () => {
    const { engine, game } = inMulligan();

    engine.timeout(game);

    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(1);
  });
});
