import { allRealCards } from '../testing/real-cards';
import { createGameState } from '../helpers/game-factory';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { buildGeneratedEntries } from './generated-entries';
import { judge } from './rollout';
import { instances, seeded } from './tournament';

function opening() {
  const [a, b] = buildGeneratedEntries(allRealCards(), 1).filter(
    (e) => e.level === 5,
  );
  const engine = createEngine(fixedRng());
  const game = createGameState(
    1,
    { userId: 1, username: a.name, socketId: 's1' },
    { userId: 2, username: b.name, socketId: 's2' },
  );
  const random = seeded(11);
  engine.setupDeck(game, 'p1', instances(a.deck, 1, random));
  engine.setupDeck(game, 'p2', instances(b.deck, 2, random));
  // Mulligans refusés, puis l'état est celui du premier tour
  for (const seat of ['p1', 'p2'] as const)
    engine.dispatch(game, seat, { type: 'mulligan', redraw: false });
  return { game, archetypes: { p1: a.archetype, p2: b.archetype } };
}

describe('judge', () => {
  it('donne un taux de victoire par coup, sans toucher à la partie, de façon reproductible', () => {
    const { game, archetypes } = opening();
    const seat = game.currentTurnUserId === 1 ? 'p1' : 'p2';
    const before = JSON.stringify(game);

    const rows = judge(game, seat, archetypes, 2, 5, 3);

    expect(JSON.stringify(game)).toBe(before);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(2);
    expect(rows!.length).toBeLessThanOrEqual(3);
    for (const r of rows!) {
      expect(r.n).toBe(2);
      expect(r.wins).toBeGreaterThanOrEqual(0);
      expect(r.wins).toBeLessThanOrEqual(2);
    }
    expect(judge(game, seat, archetypes, 2, 5, 3)).toEqual(rows);
  });
});
