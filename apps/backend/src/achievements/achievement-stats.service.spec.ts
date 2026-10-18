import type { DataSource } from 'typeorm';
import { AchievementFamily } from '@pipou/shared';
import type { UsersService } from '../users/users.service';
import { AchievementStatsService } from './achievement-stats.service';

function setup() {
  const query = jest.fn((sql: string) => {
    if (sql.includes('adventure_match'))
      return Promise.resolve([{ played: 3, won: 1, worldsCompleted: 0 }]);
    return Promise.resolve([]);
  });
  const dataSource = {
    getRepository: () => ({ findOne: () => Promise.resolve(null) }),
    query,
  } as unknown as DataSource;
  const users = {
    calculateLevelData: () => ({ level: 1 }),
  } as unknown as UsersService;
  return { service: new AchievementStatsService(dataSource, users), query };
}

describe('AchievementStatsService — combats PvE joués', () => {
  it('ne compte que les victoires ou les combats d’au moins 2 tours', async () => {
    const { service, query } = setup();
    const { values } = await service.getValues(7);
    expect(values[AchievementFamily.PVE_PLAYED]).toBe(3);

    const sql = query.mock.calls
      .map(([s]) => s)
      .find((s) => s.includes('AS played'));
    const played =
      /\(SELECT COUNT\(\*\) FROM adventure_match WHERE ([^)]*\)?[^)]*)\) AS played/.exec(
        sql!.replace(/\s+/g, ' '),
      );
    expect(played?.[1]).toBe(
      'user_id = ? AND won IS NOT NULL AND (won = 1 OR turns >= 2)',
    );
  });
});
