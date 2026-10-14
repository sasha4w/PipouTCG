import type { Rarity } from "../enums/card";
import type {
  NotificationCategory,
  NotificationType,
} from "../enums/notification";
import type { QuestRewardType } from "../enums/quest";

export interface QuestCompletedNotificationPayload {
  userQuestId: number;
  title: string;
  rewardType: QuestRewardType;
  rewardAmount: number;
}

export interface CardDropEntry {
  cardId: number;
  name: string;
  rarity: Rarity;
  isNew: boolean;
}

/** Cartes notables d'une ouverture de booster (déjà filtrées par isNotableDrop). */
export interface CardDropNotificationPayload {
  boosterName: string;
  cards: CardDropEntry[];
}

export interface ListingSoldNotificationPayload {
  buyerUsername: string;
  itemName: string;
  totalPrice: number;
  transactionId: number;
}

export interface PatchnoteNotificationPayload {
  title: string;
  body: string;
}

export interface NotificationPayloadMap {
  QUEST_COMPLETED: QuestCompletedNotificationPayload;
  CARD_DROP: CardDropNotificationPayload;
  LISTING_SOLD: ListingSoldNotificationPayload;
  PATCHNOTE: PatchnoteNotificationPayload;
}

/**
 * Message de la boîte. `id` est "n:<id>" (notification) ou "p:<id>" (patchnote) :
 * les deux tables sont fusionnées. `read` vaut false pour une quête à réclamer.
 */
export type NotificationItem = {
  [T in NotificationType]: {
    id: string;
    type: T;
    category: NotificationCategory;
    createdAt: string;
    read: boolean;
    payload: NotificationPayloadMap[T];
  };
}[NotificationType];

export interface UnreadCounts {
  all: number;
  reward: number;
  information: number;
}

/** GET /notifications */
export interface NotificationsResponse {
  items: NotificationItem[];
  unread: UnreadCounts;
}

/** GET /notifications?category=&limit= */
export interface NotificationsQuery {
  category?: NotificationCategory;
  limit?: number;
}
