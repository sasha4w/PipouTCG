import { api } from "../api/api";

export interface OpenedCard {
  id: number;
  name: string;
  rarity: string;
  type: string;
  supportType: string | null;
  atk: number;
  hp: number;
  cost: number;
  description: string | null;
  image: { id: number; url: string } | null;
  isNew: boolean;
}

export interface OpeningResult {
  cards: OpenedCard[];
}

function normalizeCards(rawCards: any[]): OpenedCard[] {
  return rawCards.map((c) => ({
    id: c.id,
    name: c.name,
    rarity: c.rarity ?? "common",
    type: c.type ?? "monster",
    supportType: c.supportType ?? null,
    atk: c.atk ?? 0,
    hp: c.hp ?? 0,
    cost: c.cost ?? 0,
    description: c.description ?? null,
    image: c.image ?? null,
    isNew: c.isNew ?? false,
  }));
}

export const openingService = {
  async openBooster(boosterId: number): Promise<OpeningResult> {
    const res = await api.post(`/boosters/${boosterId}/open`);
    return { cards: normalizeCards(res.data.cards ?? []) };
  },

  async openBundle(bundleId: number): Promise<OpeningResult> {
    const res = await api.post(`/bundles/${bundleId}/open`);
    return { cards: normalizeCards(res.data.cards ?? []) };
  },
};
