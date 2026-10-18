import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';
import { DailyRewardService } from './daily-reward.service';
import type { DailyRewardDefinition } from './daily-reward-definition.entity';
import type { LoginStreak } from './login-streak.entity';

describe('DailyRewardService — reward definition lookup', () => {
  const findOne = jest.fn();
  const service = new DailyRewardService(
    {} as never,
    { findOne } as unknown as Repository<DailyRewardDefinition>,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
  );

  afterEach(() => jest.clearAllMocks());

  it('should prefer the definition specific to the week', async () => {
    const specific = { id: 1, cycleDay: 3, weekNumber: 2 };
    findOne.mockResolvedValueOnce(specific);

    await expect(service['getRewardDefinition'](3, 2)).resolves.toBe(specific);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the generic definition (weekNumber IS NULL)', async () => {
    const generic = { id: 9, cycleDay: 3, weekNumber: null };
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(generic);

    await expect(service['getRewardDefinition'](3, 2)).resolves.toBe(generic);
    // `weekNumber: null` est ignoré par TypeORM (toute semaine correspondrait) :
    // seul IsNull() filtre réellement sur la définition générique.
    expect(findOne).toHaveBeenLastCalledWith({
      where: { cycleDay: 3, weekNumber: IsNull(), isActive: true },
    });
  });
});

const TODAY = '2026-10-16';

function setup(row: Partial<LoginStreak> | null, gold = 10_000) {
  const streak = row
    ? {
        userId: 1,
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
        cycleDay: 1,
        lastClaimDate: null,
        ...row,
      }
    : null;
  const def = {
    cycleDay: 1,
    weekNumber: null,
    rewardType: 'gold',
    rewardValue: 50,
    quantity: 1,
    label: '💎 Bonus',
  };
  const repos = {
    streak: {
      findOne: jest.fn().mockResolvedValue(streak),
      create: jest.fn((x: object) => ({
        longestStreak: 0,
        lastClaimDate: null,
        ...x,
      })),
      save: jest.fn((x: object) => Promise.resolve(x)),
    },
    def: {
      findOne: jest.fn().mockResolvedValue(def),
      create: jest.fn((x: object) => x),
      save: jest.fn((x: object) => Promise.resolve(x)),
    },
    milestone: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x: object) => x),
      save: jest.fn((x: object) => Promise.resolve(x)),
    },
    history: {
      create: jest.fn((x: object) => x),
      save: jest.fn((x: object) => Promise.resolve(x)),
      find: jest.fn().mockResolvedValue([]),
    },
    rescue: {
      create: jest.fn((x: object) => x),
      save: jest.fn((x: object) => Promise.resolve(x)),
      find: jest.fn().mockResolvedValue([]),
    },
  };
  const users = {
    addGold: jest.fn(),
    addCardToUser: jest.fn(),
    addBoosterToUser: jest.fn(),
    addBundleToUser: jest.fn(),
    findOne: jest.fn().mockResolvedValue({ gold }),
  };
  const emitter = { emit: jest.fn() };
  const service = new DailyRewardService(
    repos.streak as never,
    repos.def as never,
    repos.milestone as never,
    repos.history as never,
    repos.rescue as never,
    users as never,
    emitter as never,
  );
  return { service, repos, users, streak, emitter };
}

describe('DailyRewardService — claim', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('premier claim : streak 1, semaine 1 jour 1', async () => {
    const { service, repos, emitter } = setup(null);
    const res = await service.claimDaily(1);
    expect(res.status).toBe('claimed');
    expect(emitter.emit).toHaveBeenCalledWith('daily-reward.claimed', {
      userId: 1,
    });
    expect(res.streak.current).toBe(1);
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 1, isActive: true },
    });
  });

  it('jour consécutif : streak +1, semaine dérivée du streak', async () => {
    const { service, repos } = setup({
      currentStreak: 7,
      totalDays: 40,
      lastClaimDate: '2026-10-15',
    });
    const res = await service.claimDaily(1);
    expect(res.streak.current).toBe(8);
    expect(res.streak.totalDays).toBe(41);
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 2, isActive: true },
    });
  });

  it("déjà réclamé aujourd'hui : 409", async () => {
    const { service } = setup({ currentStreak: 3, lastClaimDate: TODAY });
    await expect(service.claimDaily(1)).rejects.toThrow('déjà réclamée');
  });

  it('un jour manqué : rescue_required avec le coût, rien distribué', async () => {
    const { service, users } = setup({
      currentStreak: 30,
      lastClaimDate: '2026-10-14',
    });
    const res = await service.claimDaily(1);
    expect(res).toMatchObject({
      status: 'rescue_required',
      rescue: { cost: 400 },
    });
    expect(users.addGold).not.toHaveBeenCalled();
  });

  it('deux jours manqués ou plus : reset auto, J1 réclamé, streakLost renvoyé', async () => {
    const { service, repos } = setup({
      currentStreak: 42,
      longestStreak: 50,
      totalDays: 90,
      lastClaimDate: '2026-10-13',
    });
    const res = await service.claimDaily(1);
    expect(res).toMatchObject({
      status: 'claimed',
      streakLost: 42,
      streak: { current: 1, longest: 50, totalDays: 91 },
    });
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 1, isActive: true },
    });
  });

  it('palier versé quand le streak atteint le seuil, même déjà atteint avant', async () => {
    const { service, repos, users } = setup({
      currentStreak: 6,
      totalDays: 200,
      lastClaimDate: '2026-10-15',
    });
    repos.milestone.findOne.mockResolvedValue({
      dayThreshold: 7,
      rewardType: 'gold',
      rewardValue: 500,
      quantity: 1,
      label: '🏆 Coffre',
    });
    const res = await service.claimDaily(1);
    expect(repos.milestone.findOne).toHaveBeenCalledWith({
      where: { dayThreshold: 7, isActive: true },
    });
    expect(users.addGold).toHaveBeenCalledWith(1, 500);
    expect(res.status === 'claimed' && res.rewards[1]).toMatchObject({
      isMilestone: true,
      label: 'Coffre',
    });
  });
});

describe('DailyRewardService — rescue & reset', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('rachat : débite 100 + 10 × streak et place lastClaimDate à hier (UTC)', async () => {
    const { service, repos, users, streak } = setup({
      currentStreak: 10,
      lastClaimDate: '2026-10-14',
    });
    const res = await service.rescueStreak(1);
    expect(res.goldSpent).toBe(200);
    expect(users.addGold).toHaveBeenCalledWith(1, -200);
    expect(streak?.lastClaimDate).toBe('2026-10-15');
    expect(repos.rescue.save).toHaveBeenCalledWith(
      expect.objectContaining({ daysMissed: 1, goldSpent: 200 }),
    );
  });

  it.each(['2026-10-15', '2026-10-13'])(
    'rachat refusé si lastClaimDate = %s',
    async (last) => {
      const { service } = setup({ currentStreak: 10, lastClaimDate: last });
      await expect(service.rescueStreak(1)).rejects.toThrow();
    },
  );

  it('rachat refusé si gold insuffisant', async () => {
    const { service, users } = setup(
      { currentStreak: 10, lastClaimDate: '2026-10-14' },
      199,
    );
    await expect(service.rescueStreak(1)).rejects.toThrow('Pas assez de gold');
    expect(users.addGold).not.toHaveBeenCalled();
  });

  it.each([TODAY, '2026-10-15'])(
    'reset refusé si lastClaimDate = %s',
    async (last) => {
      const { service, repos } = setup({
        currentStreak: 5,
        lastClaimDate: last,
      });
      await expect(service.resetStreak(1)).rejects.toThrow(
        'Rien à réinitialiser',
      );
      expect(repos.streak.save).not.toHaveBeenCalled();
    },
  );

  it('reset : streak 0, record et total conservés, prochain claim = J1', async () => {
    const { service, streak } = setup({
      currentStreak: 12,
      longestStreak: 20,
      totalDays: 80,
      lastClaimDate: '2026-10-14',
    });
    await service.resetStreak(1);
    expect(streak).toMatchObject({
      currentStreak: 0,
      longestStreak: 20,
      totalDays: 80,
      lastClaimDate: null,
    });
    const res = await service.claimDaily(1);
    expect(res.streak.current).toBe(1);
  });
});

describe('DailyRewardService — status', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('jour consécutif : prochain jour = streak + 1, pas de risque', async () => {
    const { service } = setup({
      currentStreak: 7,
      lastClaimDate: '2026-10-15',
    });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({
      alreadyClaimed: false,
      rescueAvailable: false,
      rescueCost: null,
      streakAtRisk: false,
      nextDay: { cycleDay: 1, weekNumber: 2 },
      nextReward: { type: 'gold', value: 50, label: 'Bonus' },
    });
  });

  it('un jour manqué : rachat disponible et chiffré', async () => {
    const { service } = setup({
      currentStreak: 7,
      lastClaimDate: '2026-10-14',
    });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({ rescueAvailable: true, rescueCost: 170 });
  });

  it('série perdue : streakAtRisk et prochain jour = J1', async () => {
    const { service } = setup({
      currentStreak: 30,
      lastClaimDate: '2026-10-10',
    });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({
      streakAtRisk: true,
      nextDay: { cycleDay: 1, weekNumber: 1 },
    });
  });

  it('ligne legacy sans date de claim : prochain jour = J1', async () => {
    const { service } = setup({ currentStreak: 1, lastClaimDate: null });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({ nextDay: { cycleDay: 1, weekNumber: 1 } });
  });

  it('paliers actifs depuis la BDD, labels nettoyés', async () => {
    const { service, repos } = setup({
      currentStreak: 3,
      lastClaimDate: TODAY,
    });
    repos.milestone.find.mockResolvedValue([
      {
        dayThreshold: 7,
        rewardType: 'gold',
        rewardValue: 500,
        quantity: 1,
        label: '🏆 Coffre',
      },
    ]);
    const s = await service.getStatus(1);
    expect(repos.milestone.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { dayThreshold: 'ASC' },
    });
    expect(s.milestones).toEqual([
      {
        dayThreshold: 7,
        type: 'gold',
        value: 500,
        quantity: 1,
        label: 'Coffre',
      },
    ]);
  });

  it('claimedDates dédoublonnés, rescuedDates = veille du rachat', async () => {
    const { service, repos } = setup({
      currentStreak: 3,
      lastClaimDate: TODAY,
    });
    repos.history.find.mockResolvedValue([
      { claimedAt: new Date('2026-10-14T08:00:00Z') },
      { claimedAt: new Date('2026-10-16T09:00:00Z') },
      { claimedAt: new Date('2026-10-16T09:00:01Z') },
    ]);
    repos.rescue.find.mockResolvedValue([
      { rescuedAt: new Date('2026-10-16T08:59:00Z') },
    ]);
    const s = await service.getStatus(1);
    expect(s.claimedDates).toEqual(['2026-10-14', '2026-10-16']);
    expect(s.rescuedDates).toEqual(['2026-10-15']);
  });
});

describe('DailyRewardService — labels admin', () => {
  it("retire les emojis à la création d'un palier", async () => {
    const { service, repos } = setup({});
    await service.createMilestone({
      dayThreshold: 7,
      rewardType: 'gold',
      rewardValue: 500,
      label: '🏆 Coffre',
    } as never);
    expect(repos.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Coffre' }),
    );
  });
});
