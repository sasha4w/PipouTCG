import { describe, it, expect } from "vitest";
import type { AdventureOverview, AdventureWorldView } from "@pipou/shared";
import {
  capReached,
  findOpponent,
  pathLayout,
  resumeTarget,
  sortWorlds,
} from "./adventureView";

const world = (id: number, order: number, opponentIds: number[] = []) =>
  ({
    id,
    name: `Set ${id}`,
    cardSetId: id,
    cardSetName: `Set ${id}`,
    order,
    unlocked: true,
    requires: [],
    beaten: 0,
    completed: false,
    opponents: opponentIds.map((oid) => ({ id: oid })),
  }) as unknown as AdventureWorldView;

describe("pathLayout", () => {
  it("zigzague du bas vers le haut, boss centré en haut", () => {
    expect(pathLayout(5).map((n) => n.offset)).toEqual([0, -1, 1, -1, 0]);
  });

  it("garde les extrémités centrées pour d'autres tailles", () => {
    expect(pathLayout(3).map((n) => n.offset)).toEqual([0, -1, 0]);
    expect(pathLayout(1).map((n) => n.offset)).toEqual([0]);
  });
});

describe("capReached", () => {
  const overview = (today: number, cap: number): AdventureOverview => ({
    worlds: [],
    farmRewardsToday: today,
    dailyCap: cap,
  });

  it("est vrai quand le compteur du jour atteint le plafond", () => {
    expect(capReached(overview(20, 20))).toBe(true);
    expect(capReached(overview(21, 20))).toBe(true);
    expect(capReached(overview(19, 20))).toBe(false);
  });
});

describe("sortWorlds", () => {
  it("trie par ordre puis par id sans modifier l'entrée", () => {
    const input = [world(3, 2), world(1, 1), world(2, 2)];
    expect(sortWorlds(input).map((w) => w.id)).toEqual([1, 2, 3]);
    expect(input.map((w) => w.id)).toEqual([3, 1, 2]);
  });
});

describe("findOpponent", () => {
  it("retrouve l'IA et son monde", () => {
    const overview: AdventureOverview = {
      worlds: [world(1, 1, [10, 11]), world(2, 2, [20])],
      farmRewardsToday: 0,
      dailyCap: 20,
    };
    const found = findOpponent(overview, 20);
    expect(found?.world.id).toBe(2);
    expect(found?.opponent.id).toBe(20);
    expect(findOpponent(overview, 99)).toBeNull();
  });
});

describe("resumeTarget", () => {
  it("reprend sur place une partie contre la même IA", () => {
    expect(
      resumeTarget({ matchId: 1, opponentName: "IA", adventureOpponentId: 4 }, 4),
    ).toBeNull();
  });

  it("renvoie vers l'écran d'une autre IA", () => {
    expect(
      resumeTarget({ matchId: 1, opponentName: "IA", adventureOpponentId: 7 }, 4),
    ).toBe("/adventure/fight/7");
  });

  it("renvoie vers le duel JcJ pour une partie sans IA", () => {
    expect(resumeTarget({ matchId: 1, opponentName: "Bob" }, 4)).toBe("/fight");
  });
});
