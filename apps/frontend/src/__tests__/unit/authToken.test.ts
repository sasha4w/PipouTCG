import { afterEach, describe, expect, it } from "vitest";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "../../api/authToken";

describe("authToken", () => {
  afterEach(() => clearAuthToken());

  it("sans « se souvenir de moi », vit en sessionStorage uniquement", () => {
    setAuthToken("abc", false);
    expect(sessionStorage.getItem("authToken")).toBe("abc");
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(getAuthToken()).toBe("abc");
  });

  it("avec « se souvenir de moi », vit en localStorage uniquement", () => {
    setAuthToken("abc", true);
    expect(localStorage.getItem("authToken")).toBe("abc");
    expect(sessionStorage.getItem("authToken")).toBeNull();
  });

  it("un nouveau login remplace l'ancien jeton des deux stockages", () => {
    setAuthToken("vieux", true);
    setAuthToken("neuf", false);
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(getAuthToken()).toBe("neuf");
  });

  it("clearAuthToken efface les deux stockages", () => {
    setAuthToken("abc", true);
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});
