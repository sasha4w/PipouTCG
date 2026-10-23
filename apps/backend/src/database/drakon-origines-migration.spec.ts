import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { DRAKON_ORIGINES_CARDS } from './drakon-origines-cards';
import { DrakonOriginesCards1791000000013 } from './migrations/1791000000013-DrakonOriginesCards';

/** Base factice : cartes par nom, références comptées par id. */
function fakeDb(
  opts: { existing?: string[]; withSet?: boolean; used?: number } = {},
) {
  const names = new Set(opts.existing ?? []);
  const inserts: unknown[][] = [];
  const deletes: unknown[][] = [];
  const runner = {
    query: (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT `card_set_id`'))
        return Promise.resolve(
          opts.withSet === false ? [] : [{ card_set_id: 7 }],
        );
      if (sql.includes('AS used'))
        return Promise.resolve([{ used: opts.used ?? 0 }]);
      if (sql.startsWith('SELECT `id`'))
        return Promise.resolve(
          names.has(params[0] as string) ? [{ id: 1 }] : [],
        );
      if (sql.startsWith('INSERT')) inserts.push(params);
      if (sql.startsWith('DELETE')) deletes.push(params);
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, inserts, deletes };
}

const migration = new DrakonOriginesCards1791000000013();

describe('migration DrakonOriginesCards', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('up crée les 5 cartes avec stade, élément et lignée', async () => {
    const db = fakeDb();
    await migration.up(db.runner);
    expect(db.inserts).toHaveLength(5);
    const feros = db.inserts.find((p) => p[0] === 'Ancestral Feros')!;
    expect(feros).toEqual(
      expect.arrayContaining(['ancestral', 'fire', 'feros']),
    );
  });

  it('rejouée : aucune carte recréée', async () => {
    const db = fakeDb({ existing: DRAKON_ORIGINES_CARDS.map((c) => c.name) });
    await migration.up(db.runner);
    expect(db.inserts).toHaveLength(0);
  });

  it('sans la carte de référence du set : avertit et n’insère rien', async () => {
    const db = fakeDb({ withSet: false });
    await migration.up(db.runner);
    expect(db.inserts).toHaveLength(0);
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('down ne supprime pas une carte référencée', async () => {
    const db = fakeDb({
      existing: DRAKON_ORIGINES_CARDS.map((c) => c.name),
      used: 1,
    });
    await migration.down(db.runner);
    expect(db.deletes).toHaveLength(0);
    const free = fakeDb({ existing: DRAKON_ORIGINES_CARDS.map((c) => c.name) });
    await migration.down(free.runner);
    expect(free.deletes).toHaveLength(5);
  });
});
