import { describe, it, expect } from "vitest";
import type { SandboxState } from "@pipou/shared";
import { autoViewSeat } from "../../features/sandbox/viewSeat";

function state(
  p1: Record<string, unknown>,
  p2: Record<string, unknown>,
  phase = "main",
): SandboxState {
  const view = (v: Record<string, unknown>) => ({
    phase,
    isMyTurn: false,
    me: { mulliganDone: true },
    ...v,
  });
  return { views: { p1: view(p1), p2: view(p2) } } as unknown as SandboxState;
}

describe("autoViewSeat", () => {
  it("suit le joueur actif", () => {
    expect(autoViewSeat(state({}, { isMyTurn: true }))).toBe("p2");
  });

  it("passe au joueur qui doit faire un choix, même hors de son tour", () => {
    expect(
      autoViewSeat(
        state(
          { isMyTurn: true },
          { pendingChoice: { candidates: [], count: 1, prompt: "" } },
        ),
      ),
    ).toBe("p2");
  });

  it("au mulligan, montre le premier joueur qui n'a pas décidé", () => {
    expect(
      autoViewSeat(
        state(
          { isMyTurn: true, me: { mulliganDone: true } },
          { me: { mulliganDone: false } },
          "mulligan",
        ),
      ),
    ).toBe("p2");
  });
});
