import type { QueryRunner } from 'typeorm';
import type { BalanceFields } from './balance-2026-10-patches';
import { TEROS_PATCHES } from './teros-2026-10-patches';
import { TerosNerf1791000000021 } from './migrations/1791000000021-TerosNerf';

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

const migration = new TerosNerf1791000000021();
const hpOf = (name: string) =>
  TEROS_PATCHES.find((p) => p.after.name === name)!.after.hp;

describe('migration TerosNerf', () => {
  it('up met à jour les 5 cartes', async () => {
    const db = fakeDb(TEROS_PATCHES.map((p) => p.before));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(5);
  });

  it('les PV baissent à chaque stade, Ancestral compris', () => {
    expect(hpOf('Bébé Teros')).toBe(1000);
    expect(hpOf('Jeune Teros')).toBe(1400);
    expect(hpOf('Adulte Teros')).toBe(2200);
    expect(hpOf('Ancestral Teros')).toBe(2900);
  });

  it('les dégâts divisés durent 2 tours, posés à l’invocation ou à la pose', () => {
    for (const name of [
      'Jeune Teros',
      'Adulte Teros',
      'Ancestral Teros',
      'Écaille de Dragon',
    ]) {
      const { effects } = TEROS_PATCHES.find(
        (p) => p.after.name === name,
      )!.after;
      const reductions = effects!.filter((e) =>
        e.actions.some((x) => x.type === 'SET_DAMAGE_REDUCTION'),
      );
      expect(reductions).toHaveLength(1);
      expect(reductions[0].trigger).not.toBe('PASSIVE');
      expect(reductions[0].actions[0]).toMatchObject({ value: 2, duration: 2 });
    }
  });

  it('rejouée sur une base à jour : aucune mise à jour', async () => {
    const db = fakeDb(TEROS_PATCHES.map((p) => p.after));
    await migration.up(db.runner);
    expect(db.updates).toHaveLength(0);
  });

  it('down rend les anciens PV et la réduction passive', async () => {
    const db = fakeDb(TEROS_PATCHES.map((p) => p.after));
    await migration.down(db.runner);
    expect(db.updates).toHaveLength(5);
    expect(db.table.find((t) => t.name === 'Adulte Teros')!.hp).toBe(3000);
  });
});
