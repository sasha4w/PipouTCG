import axios from "axios";

export const api = axios.create({
  baseURL: "https://tcg-backend-3lez.onrender.com",

  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
