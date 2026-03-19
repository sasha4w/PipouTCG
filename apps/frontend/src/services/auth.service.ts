import { api, cookies } from "../api/api";

export const authService = {
  async login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    cookies.set("token", res.data.access_token); // 7 jours par défaut
    return res.data;
  },

  async register(username: string, email: string, password: string) {
    const res = await api.post("/auth/register", { username, email, password });
    return res.data;
  },

  logout() {
    cookies.remove("token");
  },

  isAuthenticated() {
    const token = cookies.get("token");
    if (!token) return false;

    try {
      // Décoder le payload JWT (base64)
      const payload = JSON.parse(atob(token.split(".")[1]));
      // exp est en secondes, Date.now() en millisecondes
      const isExpired = payload.exp * 1000 < Date.now();
      if (isExpired) cookies.remove("token"); // nettoyage auto
      return !isExpired;
    } catch {
      cookies.remove("token");
      return false;
    }
  },
};
