import type { ComponentType } from "react";
import { AchievementFamily } from "@pipou/shared";
import {
  IconBooster,
  IconCards,
  IconCart,
  IconCollection,
  IconCrown,
  IconFire,
  IconGem,
  IconGold,
  IconQuest,
  IconSwords,
  IconTag,
  IconTrophy,
} from "../../components/Icons";

type FamilyIcon = ComponentType<{ size?: number; color?: string }>;

export const FAMILY_ICON: Record<AchievementFamily, FamilyIcon> = {
  [AchievementFamily.BOOSTERS_OPENED]: IconBooster,
  [AchievementFamily.CARDS_BOUGHT]: IconCart,
  [AchievementFamily.CARDS_SOLD]: IconTag,
  [AchievementFamily.SETS_COMPLETED]: IconCollection,
  [AchievementFamily.DUELS_WON]: IconTrophy,
  [AchievementFamily.DUELS_PLAYED]: IconSwords,
  [AchievementFamily.LEVEL]: IconCrown,
  [AchievementFamily.UNIQUE_CARDS]: IconCards,
  [AchievementFamily.HIGH_RARITY]: IconGem,
  [AchievementFamily.LOGIN_STREAK]: IconFire,
  [AchievementFamily.GOLD_EARNED]: IconGold,
  [AchievementFamily.QUESTS_DONE]: IconQuest,
  // TODO(adventure Task 9): icônes dédiées
  [AchievementFamily.ADVENTURE_WORLDS]: IconTrophy,
  [AchievementFamily.PVE_WON]: IconTrophy,
  [AchievementFamily.PVE_PLAYED]: IconTrophy,
};
