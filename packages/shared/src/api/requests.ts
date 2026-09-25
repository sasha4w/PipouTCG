import type { Archetype, CardType, Rarity, SupportType } from "../enums/card";
import type { BannerItemType, CardNumber, ProductType } from "../enums/commerce";
import type {
  ConditionOperator,
  QuestConditionType,
  QuestResetType,
  QuestRewardType,
} from "../enums/quest";
import type { CardEffect } from "../game/effect";

// Corps de requête envoyés par le front. Les DTOs du backend les implémentent :
// un écart entre les deux casse la compilation.

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ─── Cards & sets ─────────────────────────────────────────────────────────────

export interface CreateCardRequest {
  name: string;
  description?: string;
  rarity: Rarity;
  type: CardType;
  atk: number;
  hp: number;
  cardSetId: number;
  imageId?: number;
  cost?: number;
  supportType?: SupportType;
  archetype?: Archetype;
  effects?: CardEffect[];
}

export type UpdateCardRequest = Partial<CreateCardRequest>;

export interface CreateCardSetRequest {
  name: string;
}

export interface UpdateCardSetRequest {
  name?: string;
}

// ─── Decks ────────────────────────────────────────────────────────────────────

export interface DeckCardEntry {
  userCardId: number;
  quantity: number;
}

export interface CreateDeckRequest {
  name: string;
  cards: DeckCardEntry[];
}

// ─── Achats (annonce, booster, bundle, bannière) ──────────────────────────────

export interface BuyRequest {
  quantity?: number;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface CreateListingRequest {
  productType: ProductType;
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface UpdateListingRequest {
  unitPrice?: number;
  quantity?: number;
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export interface CreateBoosterRequest {
  name: string;
  cardNumber: CardNumber;
  cardSetId: number;
  price: number;
}

export type UpdateBoosterRequest = Partial<CreateBoosterRequest>;

export interface CreateBundleRequest {
  name: string;
  price?: number;
}

export interface UpdateBundleRequest {
  name?: string;
  price?: number;
}

export interface BundleItemEntry {
  cardId?: number;
  boosterId?: number;
  quantity?: number;
}

export interface AddBundleContentRequest {
  items: BundleItemEntry[];
}

export interface UpdateBundleContentRequest {
  quantity: number;
}

export interface CreateBannerRequest {
  title: string;
  description?: string;
  imageUrl?: string;
  itemType: BannerItemType;
  itemId: number;
  itemName: string;
  originalPrice: number;
  bannerPrice: number;
  startDate: string;
  /** Obligatoire uniquement si isPermanent est false/absent */
  endDate?: string;
  isPermanent?: boolean;
  isActive?: boolean;
}

// ─── Quests ───────────────────────────────────────────────────────────────────

export interface QuestCondition {
  type: QuestConditionType;
  amount?: number;
  rarity?: string;
  setId?: number;
  boosterId?: number;
  level?: number;
}

export interface QuestConditionGroup {
  operator: ConditionOperator;
  conditions: QuestCondition[];
}

export interface CreateQuestRequest {
  title: string;
  description?: string;
  resetType: QuestResetType;
  resetHour?: number;
  resetDayOfWeek?: number;
  endDate?: string;
  conditionGroup: QuestConditionGroup;
  rewardType: QuestRewardType;
  rewardAmount: number;
  rewardItemId?: number;
  isActive?: boolean;
}

export type UpdateQuestRequest = Partial<CreateQuestRequest>;

// ─── Récompense quotidienne ───────────────────────────────────────────────────

export interface RescueStreakRequest {
  daysToBuy: number;
}
