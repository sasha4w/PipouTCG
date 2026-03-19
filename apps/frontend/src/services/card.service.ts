import { api } from "../api/api";

export const Rarity = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
  SECRET: "secret",
} as const;
export type Rarity = (typeof Rarity)[keyof typeof Rarity];

export const CardType = {
  MONSTER: "monster",
  SUPPORT: "support",
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const SupportType = {
  EPHEMERAL: "EPHEMERAL",
  EQUIPMENT: "EQUIPMENT",
  TERRAIN: "TERRAIN",
} as const;
export type SupportType = (typeof SupportType)[keyof typeof SupportType];

export const Archetype = {
  PIPOU: "pipou",
  DRAGON: "dragon",
  PIXELMAN: "pixelman",
} as const;
export type Archetype = (typeof Archetype)[keyof typeof Archetype];

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
  effects?: any[] | null;
  image?: { id: number; url: string } | null;
  cardSet: { id: number; name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateCardData {
  name: string;
  description?: string;
  rarity: Rarity;
  type: CardType;
  atk: number;
  hp: number;
  cardSetId: number;
  cost?: number;
  supportType?: SupportType;
  archetype?: Archetype;
  effects?: any[];
  image?: File; // upload fichier
}

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

  async update(id: number, data: Partial<CreateCardData>) {
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
