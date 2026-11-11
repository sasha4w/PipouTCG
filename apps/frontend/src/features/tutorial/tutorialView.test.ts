import { describe, expect, it } from "vitest";
import {
  lessonPath,
  lessonResumeTarget,
  nextLesson,
  parseLessonId,
} from "./tutorialView";

describe("tutorialView", () => {
  it("chaîne les leçons dans l'ordre et s'arrête à la dernière", () => {
    expect(nextLesson("first-turn")).toBe("combat");
    expect(nextLesson("pixelman")).toBe("statuses");
    expect(nextLesson("statuses")).toBeNull();
  });

  it("n'accepte que les identifiants de leçon connus", () => {
    expect(parseLessonId("guard")).toBe("guard");
    expect(parseLessonId("sleep")).toBeNull();
    expect(parseLessonId(undefined)).toBeNull();
  });

  it("construit le chemin d'une leçon", () => {
    expect(lessonPath("drakon")).toBe("/tutorial/drakon");
  });

  describe("lessonResumeTarget", () => {
    const base = { matchId: -1, opponentName: "Maître Pipou" };
    it("reprend sur place la même leçon", () => {
      expect(
        lessonResumeTarget({ ...base, tutorialLessonId: "guard" }, "guard"),
      ).toBeNull();
    });
    it("renvoie vers une autre leçon en cours", () => {
      expect(
        lessonResumeTarget({ ...base, tutorialLessonId: "combat" }, "guard"),
      ).toBe("/tutorial/combat");
    });
    it("renvoie vers un combat d'aventure ou un duel", () => {
      expect(
        lessonResumeTarget({ ...base, adventureOpponentId: 4 }, "guard"),
      ).toBe("/adventure/fight/4");
      expect(lessonResumeTarget(base, "guard")).toBe("/fight");
    });
  });
});
