import { describe, it, expect } from "vitest";
import {
  AppError,
  parseApiError,
  isUserFacingError,
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
    expect(error.getUserMessage()).toBe("Authentification requise. Connectez-vous.");
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
