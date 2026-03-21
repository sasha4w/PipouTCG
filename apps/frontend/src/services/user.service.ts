import { api } from "../api/api";

export interface UserProfile {
  id: number;
  username: string;
  isPrivate: boolean;
  level: number;
  experience: number;
  currentXp: number;
  xpForNextLevel: number;
  progressPercent: number;
  gold: number;
  stats: {
    boostersOpened: number;
    cardsBought: number;
    cardsSold: number;
    moneyEarned: number;
    setsCompleted: number;
  };
}

export interface UserMe {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  gold: number;
  experience: number;
  isPrivate: boolean;
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  progressPercent: number;
}

export interface UserInventory {
  cards: {
    data: {
      id: number;
      name: string;
      rarity: string;
      atk: number;
      hp: number;
      cost: number;
      supportType?: string | null;
      description?: string;
      type: string;
      set: string;
      setId: number;
      image?: { id: number; url: string } | null;
      quantity: number;
    }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
  boosters: {
    data: { id: number; name: string; price: number; quantity: number }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
  bundles: {
    data: { id: number; name: string; price: number; quantity: number }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const userService = {
  // Moi
  async getMe(): Promise<UserMe> {
    const res = await api.get("/users/me");
    return res.data;
  },

  async getMyInventory(): Promise<UserInventory> {
    const res = await api.get("/users/me/inventory");
    return res.data;
  },

  async getMyStats(): Promise<UserProfile> {
    const res = await api.get("/users/me/stats");
    return res.data;
  },

  // Profil public
  async getProfile(id: number): Promise<UserProfile> {
    const res = await api.get(`/users/${id}/profile`);
    return res.data;
  },

  async getPortfolio(
    id: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<any>> {
    const res = await api.get(`/users/${id}/portfolio`, {
      params: { page, limit },
    });
    return res.data;
  },

  async getInventory(id: number): Promise<UserInventory> {
    const res = await api.get(`/users/${id}/inventory`);
    return res.data;
  },

  async getUserBoosters(id: number, page = 1, limit = 20) {
    const res = await api.get(`/users/${id}/boosters`, {
      params: { page, limit },
    });
    return res.data;
  },

  async getUserBundles(id: number, page = 1, limit = 20) {
    const res = await api.get(`/users/${id}/bundles`, {
      params: { page, limit },
    });
    return res.data;
  },

  // Privacy
  async togglePrivacy(id: number): Promise<{ isPrivate: boolean }> {
    const res = await api.patch(`/users/${id}/privacy`);
    return res.data;
  },

  // ADMIN
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<UserMe>> {
    const res = await api.get("/users", { params: { page, limit } });
    return res.data;
  },

  async findOne(id: number): Promise<UserMe> {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },
};
