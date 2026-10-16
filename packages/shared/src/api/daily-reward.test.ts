import { describe, expect, it } from "vitest";
import { stripEmoji } from "./daily-reward";

describe("stripEmoji", () => {
  it("retire les emojis et les espaces superflus", () => {
    expect(stripEmoji("💎 Semaine 6 - Jour 2")).toBe("Semaine 6 - Jour 2");
    expect(stripEmoji("🌹 Spécial  Saint-Valentin ❤️")).toBe("Spécial Saint-Valentin");
  });

  it("garde le texte sans emoji intact", () => {
    expect(stripEmoji("Coffre rare")).toBe("Coffre rare");
  });

  it("renvoie null pour un label vide ou composé uniquement d'emojis", () => {
    expect(stripEmoji(null)).toBeNull();
    expect(stripEmoji(undefined)).toBeNull();
    expect(stripEmoji("")).toBeNull();
    expect(stripEmoji("🏆 ✨")).toBeNull();
  });
});
