import { QuestPoolSeeder } from './quest-pool.seeder';
import { QUEST_POOL } from './quest-pool';

interface Saved {
  id?: number;
  poolKey: string;
  title: string;
  rewardAmount: number;
  isActive: boolean;
}

describe('QuestPoolSeeder', () => {
  const repo = {
    find: jest.fn(),
    save: jest.fn<Promise<void>, [Saved[]]>(),
    create: jest.fn((q: object) => ({ ...q })),
  };
  const seeder = new QuestPoolSeeder(repo as never);

  beforeEach(() => jest.clearAllMocks());

  it('crée les quêtes manquantes, actives', async () => {
    repo.find.mockResolvedValue([]);
    await seeder.seed();
    const saved = repo.save.mock.calls[0][0];
    expect(saved).toHaveLength(QUEST_POOL.length);
    expect(saved.every((q) => q.isActive)).toBe(true);
  });

  it('met à jour une quête existante sans toucher isActive', async () => {
    const existing = {
      id: 7,
      poolKey: 'd_open_1',
      title: 'ancien',
      rewardAmount: 1,
      isActive: false,
    };
    repo.find.mockResolvedValue([existing]);
    await seeder.seed();
    const saved = repo.save.mock.calls[0][0];
    const updated = saved.find((q) => q.poolKey === 'd_open_1')!;
    expect(updated).toMatchObject({
      id: 7,
      title: 'quests.pool.d_open_1',
      rewardAmount: 100,
      isActive: false,
    });
  });

  it('crée les 4 quêtes PvP/PvE', async () => {
    repo.find.mockResolvedValue([]);
    await seeder.seed();
    const saved = repo.save.mock.calls[0][0];
    expect(saved.map((q) => q.poolKey)).toEqual(
      expect.arrayContaining([
        'd_pve_win_2',
        'd_pvp_play_1',
        'w_pve_win_15',
        'w_pvp_win_5',
      ]),
    );
    expect(saved.find((q) => q.poolKey === 'd_pve_win_2')).toMatchObject({
      title: 'quests.pool.d_pve_win_2',
      rewardAmount: 150,
    });
  });
});
