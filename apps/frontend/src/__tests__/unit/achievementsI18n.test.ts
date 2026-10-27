// POOL_KEYS doit rester identique à QUEST_POOL du back (apps/backend/src/quests/quest-pool.ts).
import { describe, it, expect } from "vitest";
import { AchievementFamily } from "@pipou/shared";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";
import ko from "../../i18n/locales/ko.json";

const POOL_KEYS = [
  "d_open_1", "d_open_2", "d_open_3", "d_play_1", "d_play_2", "d_play_3", "d_win_1", "d_win_2",
  "d_buy_card_1", "d_sell_card_1", "d_list_card_1", "d_buy_booster_1", "d_obtain_10",
  "d_obtain_rare", "d_daily_reward", "w_open_15", "w_play_15", "w_win_10", "w_buy_card_10",
  "w_sell_card_10", "w_earn_1000", "w_obtain_100", "w_obtain_epic_3", "w_daily_reward_5", "w_quests_10",
  "d_destroy_card_5", "w_forge_card_3",
];

describe.each([
  ["fr", fr],
  ["en", en],
  ["ko", ko],
])("traductions %s", (_lang, locale) => {
  it("nomme chaque famille, son objectif et son titre", () => {
    for (const f of Object.values(AchievementFamily)) {
      expect(locale.achievements.families[f]).toBeTruthy();
      expect(locale.achievements.goals[f]).toContain("{{n}}");
      expect(locale.achievements.titles[f]).toBeTruthy();
    }
  });

  it("traduit chaque quête du pool", () => {
    for (const k of POOL_KEYS) {
      expect((locale.quests.pool as Record<string, string>)[k]).toBeTruthy();
    }
  });
});
