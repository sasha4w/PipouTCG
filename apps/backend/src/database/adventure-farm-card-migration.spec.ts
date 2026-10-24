import type { QueryRunner } from 'typeorm';
import { AdventureFarmCard1791000000014 } from './migrations/1791000000014-AdventureFarmCard';

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

describe('migration AdventureFarmCard', () => {
  it('up ajoute les colonnes puis la clé étrangère', async () => {
    const { runner, sql } = recorder();
    await new AdventureFarmCard1791000000014().up(runner);
    expect(sql[0]).toContain('`farm_card_id` int NULL DEFAULT NULL');
    expect(sql[0]).toContain('`farm_card_pct` decimal(5,2) NOT NULL DEFAULT 0');
    expect(sql[1]).toContain('FK_adventure_opponent_farm_card');
    expect(sql[1]).toContain('ON DELETE SET NULL');
  });

  it('down retire la clé puis les colonnes', async () => {
    const { runner, sql } = recorder();
    await new AdventureFarmCard1791000000014().down(runner);
    expect(sql[0]).toContain(
      'DROP FOREIGN KEY `FK_adventure_opponent_farm_card`',
    );
    expect(sql[1]).toContain('DROP COLUMN `farm_card_pct`');
  });
});
