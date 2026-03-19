import axios from "axios";

// Helper cookies
const cookies = {
  set: (name: string, value: string, days = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
  },
  get: (name: string) => {
    return (
      document.cookie
        .split("; ")
        .find((r) => r.startsWith(`${name}=`))
        ?.split("=")[1] ?? null
    );
  },
  remove: (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },
};

export const api = axios.create({
  baseURL: "https://tcg-backend-3lez.onrender.com/",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cookies.remove("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export { cookies };
