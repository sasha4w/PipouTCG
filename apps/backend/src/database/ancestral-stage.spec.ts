import type { QueryRunner } from 'typeorm';
import { AncestralStage1791000000011 } from './migrations/1791000000011-AncestralStage';

function recorder(): { runner: QueryRunner; sql: string[] } {
  const sql: string[] = [];
  const runner = {
    query: (q: string) => {
      sql.push(q);
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, sql };
}

describe('migration AncestralStage', () => {
  it("up ajoute 'ancestral' à l'enum stage", async () => {
    const { runner, sql } = recorder();
    await new AncestralStage1791000000011().up(runner);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("'ancestral'");
    expect(sql[0]).toContain('MODIFY `stage`');
  });

  it('down repasse les Ancestraux en Adulte puis retire la valeur', async () => {
    const { runner, sql } = recorder();
    await new AncestralStage1791000000011().down(runner);
    expect(sql[0]).toBe(
      "UPDATE `card` SET `stage` = 'adult' WHERE `stage` = 'ancestral'",
    );
    expect(sql[1]).toContain('MODIFY `stage`');
    expect(sql[1]).not.toContain('ancestral');
  });
});
