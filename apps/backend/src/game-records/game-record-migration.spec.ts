import { getMetadataArgsStorage, type QueryRunner } from 'typeorm';
import { GameRecord } from './game-record.entity';
import { GameRecord1791000000028 } from '../database/migrations/1791000000028-GameRecord';

function runner() {
  const queries: string[] = [];
  const qr = {
    query: (sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    },
  } as unknown as QueryRunner;
  return { qr, queries };
}

describe('migration game_record', () => {
  it("crée toutes les colonnes de l'entité, de façon rejouable", async () => {
    const { qr, queries } = runner();
    await new GameRecord1791000000028().up(qr);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `game_record`');
    const columns = getMetadataArgsStorage()
      .columns.filter((c) => c.target === GameRecord)
      .map((c) => c.options.name ?? c.propertyName);
    expect(columns.length).toBeGreaterThan(10);
    for (const name of columns) expect(sql).toContain(`\`${name}\``);
  });

  it('down supprime la table', async () => {
    const { qr, queries } = runner();
    await new GameRecord1791000000028().down(qr);
    expect(queries).toEqual(['DROP TABLE IF EXISTS `game_record`']);
  });
});
