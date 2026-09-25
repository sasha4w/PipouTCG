import { api } from "../api/api";
import type {
  CreateCardSetRequest,
  PaginatedResponse,
  UpdateCardSetRequest,
} from "@pipou/shared";

export interface CardSet {
  id: number;
  name: string;
}

export type { PaginatedResponse };

export const cardSetService = {
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<CardSet>> {
    const res = await api.get("/card-sets", { params: { page, limit } });
    return res.data;
  },

  async findOne(id: number): Promise<CardSet> {
    const res = await api.get(`/card-sets/${id}`);
    return res.data;
  },

  // ADMIN
  async create(name: string) {
    const body: CreateCardSetRequest = { name };
    const res = await api.post("/card-sets", body);
    return res.data;
  },

  async update(id: number, name: string) {
    const body: UpdateCardSetRequest = { name };
    const res = await api.put(`/card-sets/${id}`, body);
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/card-sets/${id}`);
    return res.data;
  },
};
