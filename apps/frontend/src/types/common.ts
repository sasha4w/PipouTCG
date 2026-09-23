/**
 * Common/shared domain models across the application
 */

// ─── Card types ───────────────────────────────────────────────────────────────

export const Rarity = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
  SECRET: "secret",
} as const;
export type Rarity = typeof Rarity[keyof typeof Rarity];

export const CardType = {
  MONSTER: "monster",
  SUPPORT: "support",
  SPELL: "spell",
} as const;
export type CardType = typeof CardType[keyof typeof CardType];

export const SupportType = {
  CONTINUOUS: "continuous",
  QUICK_PLAY: "quick_play",
  RITUAL: "ritual",
} as const;
export type SupportType = typeof SupportType[keyof typeof SupportType];

export interface Card {
  id: number;
  name: string;
  type: CardType;
  atk: number;
  hp: number;
  cost: number;
  rarity: Rarity;
  supportType?: SupportType | null;
  archetype?: string | null;
  image?: { url: string } | null;
  description?: string | null;
  effects?: CardEffect[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardEffect {
  trigger: string;
  actions: CardAction[];
}

export interface CardAction {
  type: string;
  target: string;
  value?: number;
}

// ─── User types ───────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: number;
  userId: number;
  bio?: string | null;
  preferredLanguage: "en" | "fr" | "ko";
  theme: "light" | "dark" | "system";
  createdAt: string;
  updatedAt: string;
}

// ─── Deck types ───────────────────────────────────────────────────────────────

export interface DeckCard {
  cardId: number;
  quantity: number;
}

export interface Deck {
  id: number;
  userId: number;
  name: string;
  description?: string | null;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckDto {
  name: string;
  description?: string;
  cards: DeckCard[];
}

// ─── Marketplace types ───────────────────────────────────────────────────────

export const ProductType = {
  CARD: "card",
  BOOSTER: "booster",
  BUNDLE: "bundle",
} as const;
export type ProductType = typeof ProductType[keyof typeof ProductType];

export const TransactionStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export interface ListingItem {
  id: number;
  sellerId: number;
  productType: ProductType;
  productId: number;
  price: number;
  quantity: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  buyerId: number;
  sellerId: number;
  listingId: number;
  amount: number;
  quantity: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Shop types ───────────────────────────────────────────────────────────────

export interface Banner {
  id: number;
  name: string;
  description?: string;
  image?: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booster {
  id: number;
  name: string;
  description?: string;
  price: number;
  rarity: Rarity;
  cardCount: number;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bundle {
  id: number;
  name: string;
  description?: string;
  price: number;
  items: BundleItem[];
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BundleItem {
  id: number;
  bundleId: number;
  productType: ProductType;
  productId: number;
  quantity: number;
}

// ─── Quest types ──────────────────────────────────────────────────────────────

export const RewardType = {
  CURRENCY: "currency",
  CARD: "card",
  BOOSTER: "booster",
  EXPERIENCE: "experience",
} as const;
export type RewardType = typeof RewardType[keyof typeof RewardType];

export interface QuestReward {
  type: RewardType;
  value: number;
  productId?: number;
}

export interface Quest {
  id: number;
  name: string;
  description: string;
  reward: QuestReward;
  progress: number;
  requirement: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserQuest {
  id: number;
  userId: number;
  questId: number;
  progress: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination types ─────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Match types ──────────────────────────────────────────────────────────────

export type MatchStatus = "pending" | "active" | "finished" | "abandoned";

export interface MatchPlayer {
  userId: number;
  username: string;
  deckId: number;
}

export interface Match {
  id: number;
  player1: MatchPlayer;
  player2: MatchPlayer;
  winner?: number;
  endReason?: string;
  createdAt: string;
  updatedAt: string;
  status: MatchStatus;
}

export interface PlayerStats {
  userId: number;
  username: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  rank: number;
  points: number;
}

// ─── API Response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp?: string;
}
