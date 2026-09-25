import { api } from "../api/api";
import type {
  CreateCardRequest,
  PaginatedResponse,
  UpdateCardRequest,
} from "@pipou/shared";
import {
  Archetype,
  CardType,
  Rarity,
  SupportType,
  type CardEffect,
} from "@pipou/shared";

export { Archetype, CardType, Rarity, SupportType };
export type { CardEffect };

export interface Card {
  id: number;
  name: string;
  description?: string;
  rarity: Rarity;
  type: CardType;
  atk: number;
  hp: number;
  cost: number;
  supportType?: SupportType | null;
  archetype?: Archetype | null;
  effects?: CardEffect[] | null;
  image?: { id: number; url: string } | null;
  cardSet: { id: number; name: string };
}

export type { PaginatedResponse };

/** Corps envoyé en FormData : le contrat + le fichier image éventuel. */
export type CreateCardData = CreateCardRequest & {
  image?: File; // upload fichier
};
export type UpdateCardData = UpdateCardRequest & { image?: File };

export const cardService = {
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<Card>> {
    const res = await api.get("/cards", { params: { page, limit } });
    return res.data;
  },

  async findOne(id: number): Promise<Card> {
    const res = await api.get(`/cards/${id}`);
    return res.data;
  },

  async findBySet(
    setId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Card>> {
    const res = await api.get(`/cards/set/${setId}`, {
      params: { page, limit },
    });
    return res.data;
  },

  // ADMIN - FormData car upload image possible
  async create(data: CreateCardData) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "image" && value instanceof File) {
        formData.append("image", value);
      } else if (key === "effects") {
        formData.append("effects", JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    const res = await api.post("/cards", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async update(id: number, data: UpdateCardData) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "image" && value instanceof File) {
        formData.append("image", value);
      } else if (key === "effects") {
        formData.append("effects", JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    const res = await api.put(`/cards/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/cards/${id}`);
    return res.data;
  },
};
