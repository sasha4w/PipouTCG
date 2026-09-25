import { api } from "../api/api";
import type {
  CreateBoosterRequest,
  PaginatedResponse,
  UpdateBoosterRequest,
} from "@pipou/shared";
import { CardNumber } from "@pipou/shared";

export { CardNumber };

export interface Booster {
  id: number;
  name: string;
  cardNumber: CardNumber;
  price: number;
  cardSet: {
    id: number;
    name: string;
  };
}

export type { PaginatedResponse };

export const boosterService = {
  // Récupère tous les boosters (paginé)
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<Booster>> {
    const res = await api.get("/boosters", { params: { page, limit } });
    return res.data;
  },

  // Récupère un booster par ID
  async findOne(id: number): Promise<Booster> {
    const res = await api.get(`/boosters/${id}`);
    return res.data;
  },

  // Acheter un booster
  async buy(id: number) {
    const res = await api.post(`/boosters/${id}/buy`);
    return res.data;
  },

  // Ouvrir un booster
  async open(id: number) {
    const res = await api.post(`/boosters/${id}/open`);
    return res.data;
  },

  // ADMIN - Créer un booster
  async create(data: CreateBoosterRequest) {
    const res = await api.post("/boosters", data);
    return res.data;
  },

  // ADMIN - Modifier un booster
  async update(id: number, data: UpdateBoosterRequest) {
    const res = await api.patch(`/boosters/${id}`, data);
    return res.data;
  },

  // ADMIN - Supprimer un booster
  async remove(id: number) {
    const res = await api.delete(`/boosters/${id}`);
    return res.data;
  },
};
