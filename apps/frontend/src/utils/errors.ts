/**
 * Error handling utility
 * Provides structured error types and user-friendly message mapping
 */

export type ErrorCategory = "API" | "Auth" | "Validation" | "Network" | "Unknown";

export interface AppErrorContext {
  category: ErrorCategory;
  statusCode?: number;
  originalError?: unknown;
  userFriendlyMessage: string;
  technicalDetails?: string;
}

/**
 * Custom error class for application errors
 * Extends native Error with structured context
 */
export class AppError extends Error {
  public readonly context: AppErrorContext;

  constructor(message: string, context: Partial<AppErrorContext> = {}) {
    super(message);
    this.name = "AppError";

    this.context = {
      category: "Unknown",
      userFriendlyMessage: "Une erreur est survenue",
      ...context,
    };

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.context.userFriendlyMessage;
  }

  /**
   * Get technical error details (for logging)
   */
  getTechnicalDetails(): string {
    return (
      this.context.technicalDetails ||
      this.message ||
      "Unknown error occurred"
    );
  }
}

/**
 * Map HTTP status codes to user-friendly messages
 */
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Requête invalide. Veuillez vérifier vos données.",
  401: "Authentification requise. Connectez-vous.",
  403: "Accès refusé.",
  404: "Ressource non trouvée.",
  409: "Conflit détecté. Actualisez et réessayez.",
  429: "Trop de requêtes. Attendez avant de réessayer.",
  500: "Erreur serveur. Veuillez réessayer.",
  502: "Service indisponible. Réessayez dans quelques instants.",
  503: "Service en maintenance. Réessayez plus tard.",
  504: "Délai d'attente dépassé. Réessayez.",
};

/**
 * Parse error from axios response and create AppError
 */
export function parseApiError(error: unknown): AppError {
  // Axios error
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    "config" in error
  ) {
    const axiosError = error as Record<string, unknown>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    // Extract error message from response
    let errorMessage = data?.message || data?.error || "API error";
    if (typeof errorMessage !== "string") {
      errorMessage = "API error";
    }

    const userMessage =
      HTTP_ERROR_MESSAGES[status] || "Une erreur est survenue";

    return new AppError(errorMessage, {
      category: status === 401 ? "Auth" : "API",
      statusCode: status,
      userFriendlyMessage: userMessage,
      technicalDetails: `API Error: ${status} - ${errorMessage}`,
      originalError: error,
    });
  }

  // Network error (no response)
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    error.message === "Network Error"
  ) {
    return new AppError("Network error", {
      category: "Network",
      userFriendlyMessage:
        "Erreur de connexion. Vérifiez votre connexion internet.",
      technicalDetails: "Network request failed",
      originalError: error,
    });
  }

  // Timeout error
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ECONNABORTED"
  ) {
    return new AppError("Request timeout", {
      category: "Network",
      userFriendlyMessage: "Délai d'attente dépassé. Réessayez.",
      technicalDetails: "Request timeout after 10s",
      originalError: error,
    });
  }

  // Unknown error
  if (error instanceof Error) {
    return new AppError(error.message, {
      category: "Unknown",
      userFriendlyMessage: "Une erreur inattendue est survenue",
      technicalDetails: error.stack,
      originalError: error,
    });
  }

  // Fallback
  return new AppError("Unknown error", {
    category: "Unknown",
    userFriendlyMessage: "Une erreur inattendue est survenue",
    originalError: error,
  });
}

/**
 * Log error safely (for monitoring/debugging)
 */
export function logError(error: AppError | Error): void {
  // In development, log to console
  if (import.meta.env.DEV) {
    console.error(
      `[${error instanceof AppError ? error.context.category : "Error"}]`,
      error
    );
  }

  // In production, send to error tracking service (e.g., Sentry)
  // Example: window.Sentry?.captureException(error);
}

/**
 * Is user-facing error (safe to show in UI)
 */
export function isUserFacingError(error: unknown): error is AppError {
  return error instanceof AppError;
}
