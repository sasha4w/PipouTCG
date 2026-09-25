import { describe, expect, it } from "vitest";
import {
  ActionType,
  Archetype,
  BannerItemType,
  CardNumber,
  CardType,
  ConditionOperator,
  DailyRewardType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
  MatchEndReason,
  MatchStatus,
  ProductType,
  QuestConditionType,
  QuestResetType,
  QuestRewardType,
  QuestType,
  Rarity,
  SupportType,
  TransactionStatus,
} from "./index";

// Ces valeurs sont stockées en base : les changer demande une migration.
describe("enum values match the backend database values", () => {
  it.each([
    ["Rarity", Rarity, ["common", "uncommon", "rare", "epic", "legendary", "secret"]],
    ["CardType", CardType, ["monster", "support"]],
    ["SupportType", SupportType, ["EPHEMERAL", "EQUIPMENT", "TERRAIN"]],
    ["Archetype", Archetype, ["pipou", "dragon", "pixelman"]],
    ["ProductType", ProductType, ["CARD", "BOOSTER", "BUNDLE"]],
    ["TransactionStatus", TransactionStatus, ["PENDING", "COMPLETED", "CANCELLED"]],
    ["BannerItemType", BannerItemType, ["BOOSTER", "BUNDLE"]],
    ["CardNumber", CardNumber, [1, 5, 8, 10]],
    ["QuestType", QuestType, ["DAILY", "ACHIEVEMENT"]],
    ["QuestResetType", QuestResetType, ["NONE", "DAILY", "WEEKLY", "MONTHLY", "EVENT"]],
    ["QuestRewardType", QuestRewardType, ["GOLD", "BOOSTER", "BUNDLE"]],
    [
      "QuestConditionType",
      QuestConditionType,
      ["OPEN_BOOSTER", "BUY_CARD", "SELL_CARD", "BUY_BOOSTER", "SELL_BOOSTER", "OWN_CARD", "COMPLETE_SET", "REACH_LEVEL", "WIN_FIGHT"],
    ],
    ["ConditionOperator", ConditionOperator, ["AND", "OR"]],
    ["DailyRewardType", DailyRewardType, ["gold", "card", "booster", "bundle"]],
    ["MatchStatus", MatchStatus, ["in_progress", "finished", "abandoned"]],
    ["MatchEndReason", MatchEndReason, ["primes_depleted", "deck_empty", "surrender", "disconnect"]],
    [
      "EffectTrigger",
      EffectTrigger,
      ["ON_SUMMON", "ON_DEATH", "ON_ATTACK", "ON_DEFEND", "ON_PLAY", "ON_TURN_START", "ON_TURN_END", "ON_ALLY_SUMMON", "PASSIVE"],
    ],
    [
      "EffectConditionType",
      EffectConditionType,
      ["ARCHETYPE_ON_BOARD", "HP_BELOW", "HAND_SIZE_MIN", "OPPONENT_HAS_NO_MONSTERS", "SPECIFIC_CARD_ON_BOARD"],
    ],
    [
      "EffectTarget",
      EffectTarget,
      ["SELF", "ALLY_MONSTER", "ALL_ALLIES", "ALLIES_EXCEPT_SELF", "ENEMY_MONSTER", "ALL_ENEMIES", "PLAYER", "OPPONENT", "ARCHETYPE_ALLIES", "TARGET_ALLY"],
    ],
  ])("%s", (_name, enumObject, expected) => {
    expect(Object.values(enumObject)).toEqual(expected);
  });

  it("ActionType", () => {
    expect(Object.values(ActionType)).toEqual([
      "DEAL_DAMAGE", "HEAL", "DRAW", "BUFF_ATK", "BUFF_HP", "BUFF_ATK_TEMP", "STEAL_PRIME",
      "DESTROY_MONSTER", "RETURN_TO_HAND", "DISCARD", "SET_TAUNT", "SET_PIERCING",
      "SET_ATTACKS_PER_TURN", "SET_DEBUFF_IMMUNITY", "SET_DELAY_DOUBLE_ATK", "FORCE_ATTACK_MODE",
      "RETURN_FROM_GRAVEYARD", "RETURN_FROM_GRAVEYARD_OR_DECK", "SEARCH_DECK",
      "GAIN_RECYCLE_ENERGY", "SET_FREE_SUMMON", "SET_DAMAGE_REDUCTION",
      "BUFF_HP_PER_ADJACENT_ALLY", "SET_TURN_COUNTER", "FORCE_ATTACK_MODE_ENEMY",
      "BLOCK_ATTACK", "FORCE_GUARD_LOCK_ENEMY",
    ]);
  });

  it("keeps enum keys equal to the backend member names", () => {
    expect(Rarity.LEGENDARY).toBe("legendary");
    expect(CardNumber.TEN).toBe(10);
    expect(QuestResetType.NONE).toBe("NONE");
  });
});
