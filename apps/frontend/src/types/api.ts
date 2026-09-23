/**
 * API request and response types
 * Extracted from services for centralized management
 */

import type { Card, User, Transaction } from "./common";

// ─── Auth API types ───────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
  expiresIn: number;
}

// ─── Card API types ───────────────────────────────────────────────────────────

export interface CreateCardRequest {
  name: string;
  type: string;
  atk: number;
  hp: number;
  cost: number;
  rarity: string;
  supportType?: string | null;
  archetype?: string | null;
  description?: string | null;
  effects?: any[] | null;
}

export interface UpdateCardRequest extends Partial<CreateCardRequest> {
  id: number;
}

export interface CardListResponse {
  data: Card[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Deck API types ───────────────────────────────────────────────────────────

export interface CreateDeckRequest {
  name: string;
  description?: string;
  cards: Array<{ cardId: number; quantity: number }>;
}

export interface UpdateDeckRequest extends Partial<CreateDeckRequest> {
  id: number;
}

// ─── Shop API types ───────────────────────────────────────────────────────────

export interface CreateBannerRequest {
  name: string;
  description?: string;
  image?: string | null;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

export interface UpdateBannerRequest extends Partial<CreateBannerRequest> {
  id: number;
}

export interface CreateBoosterRequest {
  name: string;
  description?: string;
  price: number;
  rarity: string;
  cardCount: number;
  image?: string | null;
}

export interface UpdateBoosterRequest extends Partial<CreateBoosterRequest> {
  id: number;
}

export interface CreateBundleRequest {
  name: string;
  description?: string;
  price: number;
  items: Array<{
    productType: string;
    productId: number;
    quantity: number;
  }>;
  image?: string | null;
}

export interface UpdateBundleRequest extends Partial<CreateBundleRequest> {
  id: number;
}

// ─── Marketplace API types ────────────────────────────────────────────────────

export interface CreateListingRequest {
  productType: string;
  productId: number;
  price: number;
  quantity: number;
}

export interface UpdateListingRequest extends Partial<CreateListingRequest> {
  id: number;
}

export interface BuyListingRequest {
  listingId: number;
  quantity: number;
}

export interface BuyListingResponse {
  transaction: Transaction;
  listing: any;
}

// ─── Quest API types ──────────────────────────────────────────────────────────

export interface CreateQuestRequest {
  name: string;
  description: string;
  reward: {
    type: string;
    value: number;
    productId?: number;
  };
  requirement: number;
  progress?: number;
}

export interface UpdateQuestRequest extends Partial<CreateQuestRequest> {
  id: number;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  message: string;
  error?: string;
  code?: string;
  details?: Record<string, any>;
}

// ─── Generic API response types ────────────────────────────────────────────────

export interface ListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SingleResponse<T> {
  data: T;
}

export interface EmptyResponse {
  success: boolean;
  message?: string;
}
