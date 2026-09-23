import { api } from "../api/api";

export const authService = {
  async login(email: string, password: string, rememberMe = false) {
    const res = await api.post("/auth/login", { email, password, rememberMe });

    return res.data;
  },

  async register(username: string, email: string, password: string) {
    const res = await api.post("/auth/register", { username, email, password });
    return res.data;
  },

  async logout() {
    return await api.post("/auth/logout");
  },
  async checkAuth() {
    try {
      const res = await api.get("/auth/me");
      return !!res.data;
    } catch {
      return false;
    }
  },
};
