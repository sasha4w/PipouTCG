import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_CATEGORY_OF,
  NotificationCategory,
  NotificationType,
  Rarity,
  isNotableDrop,
} from "../index";

describe("notifications", () => {
  it("classe chaque type dans une catégorie", () => {
    expect(NOTIFICATION_CATEGORY_OF).toEqual({
      QUEST_COMPLETED: NotificationCategory.REWARD,
      CARD_DROP: NotificationCategory.REWARD,
      LISTING_SOLD: NotificationCategory.INFORMATION,
      PATCHNOTE: NotificationCategory.INFORMATION,
    });
    expect(Object.keys(NOTIFICATION_CATEGORY_OF).sort()).toEqual(
      Object.values(NotificationType).sort(),
    );
  });

  it("notifie les cartes epic et plus, quelle que soit la nouveauté", () => {
    expect(isNotableDrop({ rarity: Rarity.EPIC, isNew: false })).toBe(true);
    expect(isNotableDrop({ rarity: Rarity.LEGENDARY, isNew: false })).toBe(true);
    expect(isNotableDrop({ rarity: Rarity.SECRET, isNew: false })).toBe(true);
  });

  it("notifie une première copie, même commune", () => {
    expect(isNotableDrop({ rarity: Rarity.COMMON, isNew: true })).toBe(true);
  });

  it("ignore une carte rare déjà possédée", () => {
    expect(isNotableDrop({ rarity: Rarity.RARE, isNew: false })).toBe(false);
    expect(isNotableDrop({ rarity: Rarity.COMMON, isNew: false })).toBe(false);
  });
});
