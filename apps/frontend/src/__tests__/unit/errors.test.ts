import { describe, it, expect } from "vitest";
import {
  AppError,
  parseApiError,
  isUserFacingError,
  apiErrorMessage,
  apiErrorStatus,
} from "../../utils/errors";

describe("AppError", () => {
  it("should create an error with default context", () => {
    const error = new AppError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.context.category).toBe("Unknown");
    expect(error.getUserMessage()).toBe("Une erreur est survenue");
  });

  it("should create an error with custom context", () => {
    const error = new AppError("API error", {
      category: "API",
      statusCode: 404,
      userFriendlyMessage: "Ressource non trouvée",
    });

    expect(error.context.category).toBe("API");
    expect(error.context.statusCode).toBe(404);
    expect(error.getUserMessage()).toBe("Ressource non trouvée");
  });

  it("should maintain proper instanceof checks", () => {
    const error = new AppError("Test");
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe("parseApiError", () => {
  it("should handle axios error with response", () => {
    const axiosError = {
      response: {
        status: 404,
        data: { message: "Not found" },
      },
      config: {},
    };

    const error = parseApiError(axiosError);

    expect(error instanceof AppError).toBe(true);
    expect(error.context.category).toBe("API");
    expect(error.context.statusCode).toBe(404);
    expect(error.getUserMessage()).toBe("Ressource non trouvée.");
  });

  it("should handle 401 as Auth error", () => {
    const axiosError = {
      response: {
        status: 401,
        data: { message: "Unauthorized" },
      },
      config: {},
    };

    const error = parseApiError(axiosError);

    expect(error.context.category).toBe("Auth");
    expect(error.getUserMessage()).toBe(
      "Authentification requise. Connectez-vous.",
    );
  });

  it("should handle network error", () => {
    const networkError = {
      message: "Network Error",
    };

    const error = parseApiError(networkError);

    expect(error.context.category).toBe("Network");
    expect(error.getUserMessage()).toContain("connexion");
  });

  it("should handle unknown error", () => {
    const unknownError = new Error("Something went wrong");
    const error = parseApiError(unknownError);

    expect(error instanceof AppError).toBe(true);
    expect(error.message).toContain("Something went wrong");
  });

  it("should handle generic object error", () => {
    const error = parseApiError({ unknown: "error" });
    expect(error instanceof AppError).toBe(true);
    expect(error.context.category).toBe("Unknown");
  });
});

describe("isUserFacingError", () => {
  it("should return true for AppError", () => {
    const error = new AppError("Test");
    expect(isUserFacingError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("Test");
    expect(isUserFacingError(error)).toBe(false);
  });

  it("should return false for unknown type", () => {
    expect(isUserFacingError(null)).toBe(false);
    expect(isUserFacingError("string")).toBe(false);
  });
});

describe("apiErrorMessage / apiErrorStatus", () => {
  // L'intercepteur axios (api.ts) rejette avec une AppError, pas l'erreur axios
  const fromInterceptor = parseApiError({
    config: {},
    response: { status: 400, data: { message: "Or insuffisant." } },
  });

  it("reads the server message from the AppError thrown by the interceptor", () => {
    expect(apiErrorMessage(fromInterceptor)).toBe("Or insuffisant.");
    expect(apiErrorStatus(fromInterceptor)).toBe(400);
  });

  it("still reads a raw axios error", () => {
    const raw = {
      config: {},
      response: { status: 401, data: { message: "Unauthorized" } },
    };
    expect(apiErrorMessage(raw)).toBe("Unauthorized");
    expect(apiErrorStatus(raw)).toBe(401);
  });

  it("returns undefined when the server sent no message", () => {
    const noMessage = parseApiError({ config: {}, response: { status: 500 } });
    expect(apiErrorMessage(noMessage)).toBeUndefined();
    expect(apiErrorMessage(new Error("boom"))).toBeUndefined();
    expect(apiErrorStatus("nope")).toBeUndefined();
  });
});
