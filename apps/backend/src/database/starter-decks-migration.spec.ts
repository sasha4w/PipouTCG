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

  it("n'émet aucun DDL ni insert quand un nom est introuvable (rejouable)", async () => {
    const { runner: r, query } = runner(() => []);
    await expect(new StarterDecks1791000000026().up(r)).rejects.toThrow();
    const writes = query.mock.calls.filter(([s]) =>
      /^(CREATE|ALTER|DROP|INSERT)/.test(s),
    );
    expect(writes).toHaveLength(0);
  });

  it('insère le bon archétype et 4 phares par deck', async () => {
    const { runner: r, query } = runner(() => [{ id: 1 }]);
    await new StarterDecks1791000000026().up(r);
    const deckInserts = query.mock.calls.filter(([s]) =>
      /INSERT INTO `starter_deck` /.test(s),
    );
    expect(deckInserts.map(([, p]) => p![0])).toEqual([
      'pipou',
      'pixelman',
      'dragon',
    ]);
    const cardInserts = query.mock.calls.filter(([s]) =>
      /INSERT INTO `starter_deck_card`/.test(s),
    );
    const featured = cardInserts.filter(([, p]) => p![3] === 1);
    expect(featured).toHaveLength(12);
    expect(
      STARTER_SEED.map((d) => d.cards.filter((c) => c.featured).length),
    ).toEqual([4, 4, 4]);
  });

  it('down : colonne user, puis starter_deck_card, puis starter_deck', async () => {
    const { runner: r, query } = runner(() => []);
    await new StarterDecks1791000000026().down(r);
    expect(query.mock.calls.map(([s]) => s)).toEqual([
      'ALTER TABLE `user` DROP COLUMN `starter_claimed_at`',
      'DROP TABLE `starter_deck_card`',
      'DROP TABLE `starter_deck`',
    ]);
  });
});
