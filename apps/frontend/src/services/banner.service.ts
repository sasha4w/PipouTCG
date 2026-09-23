import { api } from "../api/api";

export interface Banner {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  itemType: "BOOSTER" | "BUNDLE";
  itemId: number;
  itemName: string;
  originalPrice: number;
  bannerPrice: number;
  startDate: string;
  endDate: string | null;
  isPermanent: boolean;
  isActive: boolean;
}

export const bannerService = {
  async getActive(): Promise<Banner[]> {
    const res = await api.get("/banners/active");
    return res.data;
  },

  async buy(
    bannerId: number,
    quantity = 1,
  ): Promise<{ message: string; goldSpent: number; goldRemaining: number }> {
    const res = await api.post(`/banners/${bannerId}/buy`, { quantity });
    return res.data;
  },

  // Admin
  async findAll(): Promise<Banner[]> {
    const res = await api.get("/banners");
    return res.data;
  },
  async create(data: Omit<Banner, "id">): Promise<Banner> {
    const res = await api.post("/banners", data);
    return res.data;
  },
  async update(id: number, data: Partial<Banner>): Promise<Banner> {
    const res = await api.patch(`/banners/${id}`, data);
    return res.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/banners/${id}`);
  },
  async toggleActive(id: number): Promise<Banner> {
    const res = await api.patch(`/banners/${id}/toggle`);
    return res.data;
  },
};
