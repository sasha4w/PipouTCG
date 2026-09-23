import { api } from "../api/api";

export interface CardSet {
  id: number;
  name: string;
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
    const res = await api.post("/card-sets", { name });
    return res.data;
  },

  async update(id: number, name: string) {
    const res = await api.put(`/card-sets/${id}`, { name });
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/card-sets/${id}`);
    return res.data;
  },
};
