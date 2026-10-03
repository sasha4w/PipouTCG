import type { SandboxState, Seat } from "@pipou/shared";

const SEATS: Seat[] = ["p1", "p2"];

/** Siège à afficher : celui qui doit choisir, sinon décider son mulligan, sinon jouer. */
export function autoViewSeat(state: SandboxState): Seat {
  const choosing = SEATS.find((s) => state.views[s].pendingChoice);
  if (choosing) return choosing;
  if (state.views.p1.phase === "mulligan")
    return SEATS.find((s) => !state.views[s].me.mulliganDone) ?? "p1";
  return SEATS.find((s) => state.views[s].isMyTurn) ?? "p1";
}
