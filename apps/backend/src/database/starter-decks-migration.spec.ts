import type { QueryRunner } from 'typeorm';
import {
  STARTER_SEED,
  StarterDecks1791000000026,
} from './migrations/1791000000026-StarterDecks';

interface Fake {
  tables: Set<string>;
  column: boolean;
  decks: { id: number; archetype: string }[];
  cards: {
    deckId: number;
    cardId: number;
    quantity: number;
    featured: number;
  }[];
  failCardInsertAt: number | null;
  cardInserts: number;
}

/** Faux MySQL à état : DDL qui persiste, doublons refusés, échec injectable. */
function runner(cardRows?: (name: string) => unknown[]) {
  const ids = new Map<string, number>();
  const idOf = (n: string) => {
    if (!ids.has(n)) ids.set(n, ids.size + 1);
    return ids.get(n)!;
  };
  const db: Fake = {
    tables: new Set(),
    column: false,
    decks: [],
    cards: [],
    failCardInsertAt: null,
    cardInserts: 0,
  };
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    if (/FROM `card`/.test(sql)) {
      const name = params[0] as string;
      return Promise.resolve(cardRows ? cardRows(name) : [{ id: idOf(name) }]);
    }
    if (/information_schema/.test(sql))
      return Promise.resolve([{ n: db.column ? 1 : 0 }]);
    const create = /^CREATE TABLE IF NOT EXISTS `(\w+)`/.exec(sql);
    if (create) {
      db.tables.add(create[1]);
      return Promise.resolve([]);
    }
    if (/^ALTER TABLE `user` ADD/.test(sql)) {
      if (db.column) return Promise.reject(new Error('Duplicate column'));
      db.column = true;
      return Promise.resolve([]);
    }
    if (/^ALTER TABLE `user` DROP/.test(sql)) {
      if (!db.column) return Promise.reject(new Error("Can't DROP"));
      db.column = false;
      return Promise.resolve([]);
    }
    const drop = /^DROP TABLE IF EXISTS `(\w+)`/.exec(sql);
    if (drop) {
      db.tables.delete(drop[1]);
      return Promise.resolve([]);
    }
    if (/^SELECT `id` FROM `starter_deck` /.test(sql))
      return Promise.resolve(
        db.decks
          .filter((d) => d.archetype === params[0])
          .map((d) => ({ id: d.id })),
      );
    if (/^INSERT INTO `starter_deck` /.test(sql)) {
      db.decks.push({
        id: db.decks.length + 1,
        archetype: params[0] as string,
      });
      return Promise.resolve([]);
    }
    if (/^DELETE FROM `starter_deck_card`/.test(sql)) {
      db.cards = db.cards.filter((c) => c.deckId !== params[0]);
      return Promise.resolve([]);
    }
    if (/^INSERT INTO `starter_deck_card`/.test(sql)) {
      db.cardInserts++;
      if (db.failCardInsertAt === db.cardInserts)
        return Promise.reject(new Error('insert failed'));
      const [deckId, cardId, quantity, featured] = params as number[];
      if (db.cards.some((c) => c.deckId === deckId && c.cardId === cardId))
        return Promise.reject(new Error('Duplicate entry'));
      db.cards.push({ deckId, cardId, quantity, featured });
      return Promise.resolve([]);
    }
    return Promise.reject(new Error(`requête inattendue : ${sql}`));
  });
  return { runner: { query } as unknown as QueryRunner, query, db };
}

const run = (r: QueryRunner) => new StarterDecks1791000000026().up(r);
const sqls = (q: jest.Mock) => q.mock.calls.map(([s]) => s as string);

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
    await expect(run(r)).rejects.toThrow(/Chevalier Touille/);
  });

  it('échoue si un nom est ambigu', async () => {
    const { runner: r } = runner(() => [{ id: 1 }, { id: 2 }]);
    await expect(run(r)).rejects.toThrow(/Chevalier Touille/);
  });

  it("n'émet aucun DDL ni insert quand un nom est introuvable (rejouable)", async () => {
    const { runner: r, query } = runner(() => []);
    await expect(run(r)).rejects.toThrow();
    const writes = sqls(query).filter((s) =>
      /^(CREATE|ALTER|DROP|INSERT|DELETE)/.test(s),
    );
    expect(writes).toHaveLength(0);
  });

  it('insère 3 decks et 12/12/15 lignes de cartes', async () => {
    const { runner: r, db } = runner();
    await run(r);
    expect(db.decks).toHaveLength(3);
    expect(db.cards).toHaveLength(12 + 12 + 15);
  });

  it('insère le bon archétype et 4 phares par deck', async () => {
    const { runner: r, db } = runner();
    await run(r);
    expect(db.decks.map((d) => d.archetype)).toEqual([
      'pipou',
      'pixelman',
      'dragon',
    ]);
    for (const d of db.decks)
      expect(
        db.cards.filter((c) => c.deckId === d.id && c.featured === 1),
      ).toHaveLength(4);
  });

  it('rejouée sur un état déjà appliqué : aucune erreur, aucun doublon', async () => {
    const { runner: r, db } = runner();
    await run(r);
    await run(r);
    expect(db.decks).toHaveLength(3);
    expect(db.cards).toHaveLength(39);
  });

  it('un échec sur INSERT après le DDL est rattrapé par un second up', async () => {
    const { runner: r, db } = runner();
    db.failCardInsertAt = 20;
    await expect(run(r)).rejects.toThrow('insert failed');
    expect(db.column).toBe(true);
    expect(db.tables.size).toBe(2);
    db.failCardInsertAt = null;
    await run(r);
    expect(db.decks).toHaveLength(3);
    expect(db.cards).toHaveLength(39);
  });

  it('down : colonne user, puis starter_deck_card, puis starter_deck', async () => {
    const { runner: r, query, db } = runner();
    await run(r);
    query.mockClear();
    await new StarterDecks1791000000026().down(r);
    expect(sqls(query).filter((s) => !/^SELECT/.test(s))).toEqual([
      'ALTER TABLE `user` DROP COLUMN `starter_claimed_at`',
      'DROP TABLE IF EXISTS `starter_deck_card`',
      'DROP TABLE IF EXISTS `starter_deck`',
    ]);
    expect(db.column).toBe(false);
  });

  it('down fonctionne quand rien (ou presque) n’est appliqué', async () => {
    const { runner: r, db } = runner();
    await expect(new StarterDecks1791000000026().down(r)).resolves.toBe(
      undefined,
    );
    expect(db.tables.size).toBe(0);
  });
});
