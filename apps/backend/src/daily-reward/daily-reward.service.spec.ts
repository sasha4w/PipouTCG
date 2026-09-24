import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';
import { DailyRewardService } from './daily-reward.service';
import type { DailyRewardDefinition } from './daily-reward-definition.entity';

describe('DailyRewardService — reward definition lookup', () => {
  const findOne = jest.fn();
  const service = new DailyRewardService(
    {} as never,
    { findOne } as unknown as Repository<DailyRewardDefinition>,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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
