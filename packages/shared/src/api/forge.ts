export interface ForgeInput {
  cardId: number;
  quantity: number;
}

export interface ForgeRequest {
  inputs: ForgeInput[];
  targetCardId: number;
}

export interface ForgeResponse {
  targetCardId: number;
  dust: number;
}

export interface DestroyRequest {
  cardId: number;
  quantity: number;
}

export interface DestroyResponse {
  dustGained: number;
  dust: number;
}

export interface DestroyBatchRequest {
  items: DestroyRequest[];
}

export interface DestroyBatchResponse {
  dustGained: number;
  dust: number;
  destroyed: number;
}

export interface UsableCard {
  cardId: number;
  owned: number;
  usable: number;
  /** Copies verrouillées par le joueur (verrou de collection). */
  lockedQuantity: number;
}

/** Corps de PATCH /users/me/cards/:cardId/lock : 0 <= locked <= quantité possédée. */
export interface CardLockRequest {
  locked: number;
}

export interface CardLockResponse {
  cardId: number;
  lockedQuantity: number;
}
