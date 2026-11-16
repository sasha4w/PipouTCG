import { describe, it, expect } from "vitest";
import { PuzzleObjectiveType } from "@pipou/shared";
import { countdown, objectiveText, streakDots } from "./puzzleView";

describe("objectiveText", () => {
  it("gagner la partie", () => {
    expect(objectiveText({ type: PuzzleObjectiveType.WIN_GAME })).toEqual({
      key: "puzzle.objective.WIN_GAME",
      vars: {},
    });
  });
  it("détruire un monstre : nom de la cible, « ? » à défaut", () => {
    const o = { type: PuzzleObjectiveType.DESTROY_MONSTER };
    expect(objectiveText({ ...o, targetName: "Pipou" }).vars).toEqual({ name: "Pipou" });
    expect(objectiveText(o).vars).toEqual({ name: "?" });
  });
  it("vider le plateau adverse", () => {
    expect(objectiveText({ type: PuzzleObjectiveType.CLEAR_ENEMY_BOARD }).key).toBe(
      "puzzle.objective.CLEAR_ENEMY_BOARD",
    );
  });
  it("prendre des primes : compteur, 1 à défaut", () => {
    const o = { type: PuzzleObjectiveType.TAKE_PRIMES };
    expect(objectiveText({ ...o, primes: 3 })).toEqual({
      key: "puzzle.objective.TAKE_PRIMES",
      vars: { count: 3 },
    });
    expect(objectiveText(o).vars).toEqual({ count: 1 });
  });
});

describe("streakDots", () => {
  it("série à 4 : 4 points remplis, le 7e est le cadeau", () => {
    const dots = streakDots({ current: 4, longest: 4, nextBoosterIn: 3 });
    expect(dots).toHaveLength(7);
    expect(dots.filter((d) => d.filled)).toHaveLength(4);
    expect(dots[6].gift).toBe(true);
    expect(dots.filter((d) => d.gift)).toHaveLength(1);
  });
  it("série à 7 : nouveau cycle, aucun point rempli", () => {
    const dots = streakDots({ current: 7, longest: 7, nextBoosterIn: 7 });
    expect(dots.some((d) => d.filled)).toBe(false);
  });
  it("veille du booster : 6 points remplis", () => {
    const dots = streakDots({ current: 6, longest: 6, nextBoosterIn: 1 });
    expect(dots.filter((d) => d.filled)).toHaveLength(6);
  });
});

describe("countdown", () => {
  const reset = "2026-11-13T00:00:00.000Z";
  it("formate HH:MM:SS", () => {
    const now = new Date("2026-11-12T16:17:50.000Z").getTime();
    expect(countdown(reset, now)).toBe("07:42:10");
  });
  it("borné à 00:00:00 une fois dépassé", () => {
    expect(countdown(reset, new Date("2026-11-13T01:00:00.000Z").getTime())).toBe("00:00:00");
  });
});
