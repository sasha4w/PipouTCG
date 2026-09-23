import { api } from "../api/api";

export interface BundleItem {
  cardId?: number;
  boosterId?: number;
  quantity?: number;
}

export interface BundleContent {
  id: number;
  quantity: number;
  card?: { id: number; name: string };
  booster?: { id: number; name: string };
}

export interface Bundle {
  id: number;
  name: string;
  price: number;
  contents: BundleContent[];
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

export const bundleService = {
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<Bundle>> {
    const res = await api.get("/bundles", { params: { page, limit } });
    return res.data;
  },

  async findOne(id: number): Promise<Bundle> {
    const res = await api.get(`/bundles/${id}`);
    return res.data;
  },

  async buy(id: number) {
    const res = await api.post(`/bundles/${id}/buy`);
    return res.data;
  },

  async open(id: number) {
    const res = await api.post(`/bundles/${id}/open`);
    return res.data;
  },

  // ADMIN
  async create(data: { name: string; price?: number }) {
    const res = await api.post("/bundles", data);
    return res.data;
  },

  async update(id: number, data: { name?: string; price?: number }) {
    const res = await api.patch(`/bundles/${id}`, data);
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/bundles/${id}`);
    return res.data;
  },

  async addContent(id: number, items: BundleItem[]) {
    const res = await api.post(`/bundles/${id}/contents`, { items });
    return res.data;
  },
  async updateContent(bundleId: number, contentId: number, quantity: number) {
    const res = await api.patch(`/bundles/${bundleId}/contents/${contentId}`, {
      quantity,
    });
    return res.data;
  },

  async removeContent(bundleId: number, contentId: number) {
    const res = await api.delete(`/bundles/${bundleId}/contents/${contentId}`);
    return res.data;
  },
};
