import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "./achievements";
import { AchievementFamily } from "../enums/achievement";
import { TUTORIAL_LESSONS, TUTORIAL_REWARD, isTutorialLessonId } from "./tutorial";

describe("tutoriel", () => {
  it("a 9 leçons aux identifiants uniques", () => {
    expect(TUTORIAL_LESSONS).toHaveLength(9);
    expect(new Set(TUTORIAL_LESSONS).size).toBe(9);
  });

  it("reconnaît un identifiant de leçon", () => {
    expect(isTutorialLessonId("first-turn")).toBe(true);
    expect(isTutorialLessonId("sleep")).toBe(false);
    expect(isTutorialLessonId(3)).toBe(false);
  });

  it("verse 100 or et 50 XP par leçon", () => {
    expect(TUTORIAL_REWARD).toEqual({ gold: 100, xp: 50 });
  });

  it("le succès TUTORIAL_LESSONS monte à toutes les leçons", () => {
    const a = ACHIEVEMENTS.find((x) => x.family === AchievementFamily.TUTORIAL_LESSONS);
    expect(a?.tiers.map((t) => t.threshold)).toEqual([1, 4, TUTORIAL_LESSONS.length]);
  });
});
