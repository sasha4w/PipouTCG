import { describe, it, expect } from "vitest";
import { canSubmitForge, selectionTotal } from "./forgeSelection";

describe("forgeSelection", () => {
  it("additionne les copies sélectionnées", () => {
    expect(selectionTotal({ 1: 4, 2: 6 })).toBe(10);
    expect(selectionTotal({})).toBe(0);
  });

  it("n'autorise l'envoi que lorsque la somme égale le coût", () => {
    expect(canSubmitForge({ 1: 4, 2: 6 }, 10)).toBe(true);
    expect(canSubmitForge({ 1: 4, 2: 5 }, 10)).toBe(false);
    expect(canSubmitForge({ 1: 8, 2: 6 }, 10)).toBe(false);
  });
});
