import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { parseApiError, logError } from "../utils/errors";

/**
 * Create axios instance with base configuration
 */
export const api: AxiosInstance = axios.create({
  baseURL: "https://tcg-backend-3lez.onrender.com",
  withCredentials: true,
  timeout: 10000, // 10 seconds
});

/**
 * Request interceptor
 * - Add logging in development
 * - Add auth headers if needed (tokens already in cookies)
 */
api.interceptors.request.use(
  (config) => {
    // Log requests in development
    if (import.meta.env.DEV) {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    logError(parseApiError(error));
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * - Handle 401 errors (unauthorized)
 * - Retry 5xx errors (server errors)
 * - Parse and transform errors
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.debug(
        `[API] ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`
      );
    }

    return response;
  },
  async (error: AxiosError) => {
    // Handle 401 (Unauthorized) - redirect to login
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      // Clear any stored auth data
      localStorage.removeItem("authToken");
      sessionStorage.clear();

      // Redirect to login
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Retry logic for 5xx errors (server errors)
    const config = error.config as Record<string, unknown>;
    if (
      config &&
      error.response &&
      error.response.status >= 500 &&
      error.response.status < 600
    ) {
      // Get retry count from config (default to 0)
      const retryCount = (config._retryCount || 0) as number;

      // Max 3 retries
      if (retryCount < 3) {
        config._retryCount = retryCount + 1;

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, retryCount) * 1000;

        if (import.meta.env.DEV) {
          console.debug(
            `[API] Retrying ${config.url} (attempt ${retryCount + 1}/3) after ${delayMs}ms`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

    // Log error
    const appError = parseApiError(error);
    logError(appError);

    return Promise.reject(appError);
  }
);

/**
 * Request deduplication to prevent duplicate API calls
 * Stores pending requests and reuses their promises
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Wrap api calls with deduplication (optional, for get requests mainly)
 */
export function apiWithDedup<T>(
  promiseFactory: () => Promise<T>,
  cacheKey: string
): Promise<T> {
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey) as Promise<T>;
  }

  const promise = promiseFactory().finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, promise);
  return promise;
}
