import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  ACHIEVEMENT_REWARD_BUNDLE_ID,
  ConditionOperator,
  QuestConditionType as C,
  QuestResetType,
  QuestRewardType,
  Rarity,
} from '@pipou/shared';
import type { Quest, QuestCondition } from './quest.entity';
import { RESET_HOUR, WEEKLY_RESET_DAY } from './quest-schedule';

type PoolResetType = typeof QuestResetType.DAILY | typeof QuestResetType.WEEKLY;

export interface PoolQuest {
  poolKey: string;
  resetType: PoolResetType;
  condition: QuestCondition;
  rewardType: QuestRewardType;
  rewardAmount: number;
  rewardItemId?: number;
}

type Reward = Pick<PoolQuest, 'rewardType' | 'rewardAmount' | 'rewardItemId'>;

const gold = (amount: number): Reward => ({
  rewardType: QuestRewardType.GOLD,
  rewardAmount: amount,
});
const booster: Reward = {
  rewardType: QuestRewardType.BOOSTER,
  rewardAmount: 1,
  rewardItemId: ACHIEVEMENT_REWARD_BOOSTER_ID,
};
const bundle: Reward = {
  rewardType: QuestRewardType.BUNDLE,
  rewardAmount: 1,
  rewardItemId: ACHIEVEMENT_REWARD_BUNDLE_ID,
};

const daily = (
  poolKey: string,
  condition: QuestCondition,
  reward: Reward,
): PoolQuest => ({
  poolKey,
  resetType: QuestResetType.DAILY,
  condition,
  ...reward,
});
const weekly = (
  poolKey: string,
  condition: QuestCondition,
  reward: Reward,
): PoolQuest => ({
  poolKey,
  resetType: QuestResetType.WEEKLY,
  condition,
  ...reward,
});

export const QUEST_POOL: readonly PoolQuest[] = [
  daily('d_open_1', { type: C.OPEN_BOOSTER, amount: 1 }, gold(100)),
  daily('d_open_2', { type: C.OPEN_BOOSTER, amount: 2 }, gold(150)),
  daily('d_open_3', { type: C.OPEN_BOOSTER, amount: 3 }, gold(200)),
  daily('d_play_1', { type: C.PLAY_FIGHT, amount: 1 }, gold(100)),
  daily('d_play_2', { type: C.PLAY_FIGHT, amount: 2 }, gold(150)),
  daily('d_play_3', { type: C.PLAY_FIGHT, amount: 3 }, gold(200)),
  daily('d_win_1', { type: C.WIN_FIGHT, amount: 1 }, gold(150)),
  daily('d_win_2', { type: C.WIN_FIGHT, amount: 2 }, gold(250)),
  daily('d_pve_win_2', { type: C.WIN_PVE_FIGHT, amount: 2 }, gold(150)),
  daily('d_pvp_play_1', { type: C.PLAY_PVP_FIGHT, amount: 1 }, gold(150)),
  daily('d_buy_card_1', { type: C.BUY_CARD, amount: 1 }, gold(100)),
  daily('d_sell_card_1', { type: C.SELL_CARD, amount: 1 }, gold(100)),
  daily('d_list_card_1', { type: C.LIST_CARD, amount: 1 }, gold(100)),
  daily('d_buy_booster_1', { type: C.BUY_BOOSTER, amount: 1 }, gold(100)),
  daily('d_obtain_10', { type: C.OBTAIN_CARD, amount: 10 }, gold(100)),
  daily(
    'd_obtain_rare',
    { type: C.OBTAIN_CARD, amount: 1, minRarity: Rarity.RARE },
    gold(150),
  ),
  daily('d_daily_reward', { type: C.CLAIM_DAILY_REWARD, amount: 1 }, gold(100)),

  weekly('w_open_15', { type: C.OPEN_BOOSTER, amount: 15 }, booster),
  weekly('w_play_15', { type: C.PLAY_FIGHT, amount: 15 }, gold(500)),
  weekly('w_win_10', { type: C.WIN_FIGHT, amount: 10 }, booster),
  weekly('w_pve_win_15', { type: C.WIN_PVE_FIGHT, amount: 15 }, booster),
  weekly('w_pvp_win_5', { type: C.WIN_PVP_FIGHT, amount: 5 }, booster),
  weekly('w_buy_card_10', { type: C.BUY_CARD, amount: 10 }, gold(500)),
  weekly('w_sell_card_10', { type: C.SELL_CARD, amount: 10 }, gold(500)),
  weekly('w_earn_1000', { type: C.EARN_GOLD, amount: 1000 }, gold(500)),
  weekly('w_obtain_100', { type: C.OBTAIN_CARD, amount: 100 }, gold(500)),
  weekly(
    'w_obtain_epic_3',
    { type: C.OBTAIN_CARD, amount: 3, minRarity: Rarity.EPIC },
    booster,
  ),
  weekly(
    'w_daily_reward_5',
    { type: C.CLAIM_DAILY_REWARD, amount: 5 },
    gold(500),
  ),
  weekly('w_quests_10', { type: C.COMPLETE_QUEST, amount: 10 }, bundle),
];

/** Champs écrits en base pour une quête du pool (isActive n'en fait jamais partie). */
export function poolQuestFields(p: PoolQuest): Partial<Quest> {
  return {
    poolKey: p.poolKey,
    title: `quests.pool.${p.poolKey}`,
    resetType: p.resetType,
    resetHour: RESET_HOUR,
    resetDayOfWeek:
      p.resetType === QuestResetType.WEEKLY ? WEEKLY_RESET_DAY : undefined,
    conditionGroup: {
      operator: ConditionOperator.AND,
      conditions: [p.condition],
    },
    rewardType: p.rewardType,
    rewardAmount: p.rewardAmount,
    ...(p.rewardItemId !== undefined ? { rewardItemId: p.rewardItemId } : {}),
  };
}
