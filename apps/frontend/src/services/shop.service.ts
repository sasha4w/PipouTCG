import { api } from "../api/api";

export interface ShopBooster {
  id: number;
  name: string;
  cardNumber: number;
  price: number;
  cardSetName: string;
}

export interface ShopBundle {
  id: number;
  name: string;
  price: number;
  contents: { itemType: string; itemName: string; quantity: number }[];
}

export interface ShopCatalog {
  boosters: ShopBooster[];
  bundles: ShopBundle[];
}

export const shopService = {
  async getCatalog(): Promise<ShopCatalog> {
    const res = await api.get("/shop");
    return res.data;
  },

  async buyBooster(
    boosterId: number,
    quantity = 1,
  ): Promise<{ success: boolean; newBalance: number }> {
    const res = await api.post(`/boosters/${boosterId}/buy`, { quantity });
    return { success: true, newBalance: res.data.goldRemaining };
  },

  async buyBundle(
    bundleId: number,
    quantity = 1,
  ): Promise<{ success: boolean; newBalance: number }> {
    const res = await api.post(`/bundles/${bundleId}/buy`, { quantity });
    return { success: true, newBalance: res.data.goldRemaining };
  },
  async buyBanner(
    bannerId: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    const res = await api.post(`/shop/buy/banner/${bannerId}`);
    return res.data;
  },
};
