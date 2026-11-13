import type { DataSource } from 'typeorm';
import { AchievementFamily } from '@pipou/shared';
import type { UsersService } from '../users/users.service';
import { AchievementStatsService } from './achievement-stats.service';

function setup(solves: string[] = []) {
  const query = jest.fn((sql: string) => {
    if (sql.includes('user_tutorial_lesson'))
      return Promise.resolve([{ total: 4 }]);
    if (sql.includes('user_puzzle_solve'))
      return Promise.resolve(solves.map((date) => ({ date })));
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

describe('AchievementStatsService — leçons du tutoriel', () => {
  it('compte les leçons terminées par le joueur', async () => {
    const { service, query } = setup();
    const { values } = await service.getValues(7);
    expect(values[AchievementFamily.TUTORIAL_LESSONS]).toBe(4);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('user_tutorial_lesson'),
      [7],
    );
  });
});

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

describe('AchievementStatsService — défis du jour', () => {
  it('compte les défis résolus et la meilleure série', async () => {
    const { service, query } = setup([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-10',
    ]);
    const { values } = await service.getValues(7);
    expect(values[AchievementFamily.PUZZLES_SOLVED]).toBe(4);
    expect(values[AchievementFamily.PUZZLE_STREAK]).toBe(3);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('user_puzzle_solve'),
      [7],
    );
  });

  it('vaut 0 sans aucune résolution', async () => {
    const { service } = setup();
    const { values } = await service.getValues(7);
    expect(values[AchievementFamily.PUZZLES_SOLVED]).toBe(0);
    expect(values[AchievementFamily.PUZZLE_STREAK]).toBe(0);
  });
});
