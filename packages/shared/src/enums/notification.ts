import { Rarity } from "./card";

// Ces valeurs sont stockées en base (colonne notification.type).
export const NotificationType = {
  QUEST_COMPLETED: "QUEST_COMPLETED",
  CARD_DROP: "CARD_DROP",
  LISTING_SOLD: "LISTING_SOLD",
  PATCHNOTE: "PATCHNOTE",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationCategory = {
  REWARD: "reward",
  INFORMATION: "information",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORY_OF: Record<
  NotificationType,
  NotificationCategory
> = {
  [NotificationType.QUEST_COMPLETED]: NotificationCategory.REWARD,
  [NotificationType.CARD_DROP]: NotificationCategory.REWARD,
  [NotificationType.LISTING_SOLD]: NotificationCategory.INFORMATION,
  [NotificationType.PATCHNOTE]: NotificationCategory.INFORMATION,
};

/** Messages affichés par page de la boîte. */
export const INBOX_PAGE_SIZE = 15;
/** Un patchnote reste visible (et comptabilisé non lu) pendant ce délai. */
export const PATCHNOTE_VISIBLE_DAYS = 30;
/** Un message lu est supprimé après ce délai. */
export const READ_RETENTION_DAYS = 30;

/** Rareté à partir de laquelle un drop déclenche un message. */
export const DROP_NOTIFICATION_MIN_RARITY: Rarity = Rarity.EPIC;

const RARITY_RANK: Record<Rarity, number> = {
  [Rarity.COMMON]: 0,
  [Rarity.UNCOMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 3,
  [Rarity.LEGENDARY]: 4,
  [Rarity.SECRET]: 5,
};

/** Un drop est notable s'il atteint le seuil de rareté ou si c'est une première copie. */
export function isNotableDrop(card: { rarity: Rarity; isNew: boolean }): boolean {
  return (
    card.isNew ||
    RARITY_RANK[card.rarity] >= RARITY_RANK[DROP_NOTIFICATION_MIN_RARITY]
  );
}
