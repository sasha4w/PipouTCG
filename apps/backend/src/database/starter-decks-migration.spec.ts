import type { QueryRunner } from 'typeorm';
import {
  STARTER_SEED,
  StarterDecks1791000000026,
} from './migrations/1791000000026-StarterDecks';

function runner(cardRows: (name: string) => unknown[]) {
  const query = jest.fn((sql: string, params?: unknown[]) => {
    if (/FROM `card`/.test(sql))
      return Promise.resolve(cardRows(params![0] as string));
    return Promise.resolve(/SELECT/.test(sql) ? [{ id: 1 }] : []);
  });
  return { runner: { query } as unknown as QueryRunner, query };
}

describe('StarterDecks1791000000026', () => {
  it.each(STARTER_SEED)(
    '$archetype : 30 cartes, 4 phares, 3 copies max',
    (deck) => {
      expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(30);
      expect(deck.cards.filter((c) => c.featured)).toHaveLength(4);
      expect(
        Math.max(...deck.cards.map((c) => c.quantity)),
      ).toBeLessThanOrEqual(3);
    },
  );

  it('échoue si une carte est introuvable', async () => {
    const { runner: r } = runner(() => []);
    await expect(new StarterDecks1791000000026().up(r)).rejects.toThrow(
      /Chevalier Touille/,
    );
  });

  it('échoue si un nom est ambigu', async () => {
    const { runner: r } = runner(() => [{ id: 1 }, { id: 2 }]);
    await expect(new StarterDecks1791000000026().up(r)).rejects.toThrow(
      /Chevalier Touille/,
    );
  });

  it('insère 3 decks et 12/12/15 lignes de cartes', async () => {
    let id = 0;
    const { runner: r, query } = runner(() => [{ id: ++id }]);
    await new StarterDecks1791000000026().up(r);
    const inserts = query.mock.calls.filter(([s]) =>
      /INSERT INTO `starter_deck_card`/.test(s),
    );
    expect(inserts).toHaveLength(12 + 12 + 15);
  });
});
