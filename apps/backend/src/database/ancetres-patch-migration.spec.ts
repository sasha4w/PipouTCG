import type { QueryRunner } from 'typeorm';
import type { BalanceFields } from './balance-2026-10-patches';
import { ANCETRES_PATCHES } from './ancetres-2026-10-patches';
import { AncetresNerf1791000000020 } from './migrations/1791000000020-AncetresNerf';

/** Base factice : une ligne par nom de carte, UPDATE enregistrés et appliqués. */
function fakeDb(rows: BalanceFields[]) {
  const table = rows.map((r, i) => ({
    id: i + 1,
    ...r,
    effects: r.effects === null ? null : JSON.stringify(r.effects),
  }));
  const updates: unknown[][] = [];
  const runner = {
    query: (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('SELECT'))
        return Promise.resolve(table.filter((t) => params.includes(t.name)));
      if (sql.startsWith('UPDATE')) {
        updates.push(params);
        const row = table.find((t) => t.id === params[6]);
        if (row)
          Object.assign(row, {
            name: params[0],
            description: params[1],
            atk: params[2],
            hp: params[3],
            cost: params[4],
            effects: params[5],
          });
      }
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, updates, table };
}

const migration = new AncetresNerf1791000000020();

describe('migration AncetresNerf', () => {
  it("up exclut Appel des ancêtres de l'effet", async () => {
    const db = fakeDb(ANCETRES_PATCHES.map((p) => p.before));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(1);
    expect(db.table[0].effects).toContain('"excludeName":"Appel des ancêtres"');
  });

  it('rejouée sur une base à jour : aucune mise à jour', async () => {
    const db = fakeDb(ANCETRES_PATCHES.map((p) => p.after));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(0);
  });

  it("down rend l'ancien effet", async () => {
    const db = fakeDb(ANCETRES_PATCHES.map((p) => p.after));
    await migration.down(db.runner);
    expect(db.updates).toHaveLength(1);
    expect(db.table[0].effects).not.toContain('excludeName');
  });
});
