import { api } from "../api/api";
import { clearAuthToken, setAuthToken } from "../api/authToken";

export const authService = {
  async login(email: string, password: string, rememberMe = false) {
    const res = await api.post("/auth/login", { email, password, rememberMe });

    // Repli pour les navigateurs qui bloquent le cookie tiers
    if (typeof res.data?.access_token === "string") {
      setAuthToken(res.data.access_token, rememberMe);
    }
    return res.data;
  },

  async register(username: string, email: string, password: string) {
    const res = await api.post("/auth/register", { username, email, password });
    return res.data;
  },

  async logout() {
    try {
      return await api.post("/auth/logout");
    } finally {
      clearAuthToken();
    }
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
