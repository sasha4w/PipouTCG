import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import type { BalanceFields } from './balance-2026-10-patches';
import { GARDE_PATCHES } from './garde-2026-10-patches';
import { GardeRelevePatch1791000000012 } from './migrations/1791000000012-GardeRelevePatch';

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

const migration = new GardeRelevePatch1791000000012();

describe('migration GardeRelevePatch', () => {
  it('up met à jour les 15 cartes, dont le renommage de Force Delta', async () => {
    const db = fakeDb(GARDE_PATCHES.map((p) => p.before));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(15);
    expect(db.table.some((t) => t.name === 'Force Plasma')).toBe(true);
  });

  it('rejouée sur une base à jour : aucune mise à jour', async () => {
    const db = fakeDb(GARDE_PATCHES.map((p) => p.after));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(0);
  });

  it('une carte modifiée à la main n’est pas touchée', async () => {
    const rows = GARDE_PATCHES.map((p) => p.before);
    rows[0] = { ...rows[0], description: 'modifiée à la main' };
    const db = fakeDb(rows);
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(14);
  });

  it('down retrouve Force Plasma et lui rend son ancien nom', async () => {
    const db = fakeDb(GARDE_PATCHES.map((p) => p.after));
    await migration.down(db.runner);
    expect(db.updates).toHaveLength(15);
    expect(db.table.some((t) => t.name === 'Force Delta')).toBe(true);
  });
});

describe('migration GardeRelevePatch : pas de fausse alerte', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['up', 'down'] as const)(
    '%s rejouée sur une base déjà dans cet état : aucun avertissement',
    async (direction) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const db = fakeDb(
        GARDE_PATCHES.map((p) => (direction === 'up' ? p.after : p.before)),
      );
      await migration[direction](db.runner);
      expect(db.updates).toHaveLength(0);
      expect(warn).not.toHaveBeenCalled();
    },
  );
});
