import { describe, expect, it } from "vitest";
import { HAND_LIMIT } from "@pipou/shared";
import { phaseOptions } from "../../features/fight/phaseOptions";

describe("phaseOptions", () => {
  it("main propose combat, contrôle et finir le tour", () => {
    expect(phaseOptions("main", 5)).toEqual([
      { target: "battle", steps: 1 },
      { target: "end", steps: 2 },
      { target: "endTurn", steps: 3 },
    ]);
  });

  it("battle ne propose jamais de revenir en arrière", () => {
    expect(phaseOptions("battle", 5).map((o) => o.target)).toEqual([
      "end",
      "endTurn",
    ]);
  });

  it("end : finir le tour seulement", () => {
    expect(phaseOptions("end", 5)).toEqual([{ target: "endTurn", steps: 1 }]);
  });

  it("main avec main trop pleine : finir le tour grisé, contrôle autorisé", () => {
    const o = phaseOptions("main", HAND_LIMIT + 2);
    expect(o.find((x) => x.target === "endTurn")?.disabledReason).toBe(
      "discard",
    );
    expect(o.find((x) => x.target === "end")?.disabledReason).toBeUndefined();
  });

  it("waiting / mulligan / finished : aucune option", () => {
    expect(phaseOptions("mulligan", 5)).toEqual([]);
    expect(phaseOptions("waiting", 5)).toEqual([]);
    expect(phaseOptions("finished", 5)).toEqual([]);
  });
});
