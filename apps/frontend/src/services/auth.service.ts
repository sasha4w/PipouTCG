import { api, cookies } from "../api/api";

export const authService = {
  async login(email: string, password: string, rememberMe = false) {
    const res = await api.post("/auth/login", { email, password, rememberMe });

    const expires = rememberMe ? 30 : undefined;
    cookies.set("token", res.data.access_token, expires);

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
      const payload = JSON.parse(atob(token.split(".")[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      if (isExpired) cookies.remove("token");
      return !isExpired;
    } catch {
      cookies.remove("token");
      return false;
    }
  },
};
