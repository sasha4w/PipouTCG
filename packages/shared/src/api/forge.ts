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

export interface UsableCard {
  cardId: number;
  owned: number;
  usable: number;
}
