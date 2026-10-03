import { describe, it, expect, vi } from "vitest";
import type { GameAction } from "@pipou/shared";
import { emitGameAction } from "../../features/fight/emitGameAction";
import type { FightClientSocket } from "../../features/fight/fight.types";

function socket() {
  const emit = vi.fn();
  return { emit, socket: { emit } as unknown as FightClientSocket };
}

describe("emitGameAction", () => {
  it.each<[GameAction, string, object]>([
    [{ type: "mulligan", redraw: true }, "fight:mulligan", { redraw: true }],
    [{ type: "end_phase" }, "fight:end_phase", {}],
    [
      {
        type: "summon",
        handIndex: 1,
        zoneIndex: 2,
        paymentHandIndices: [0],
        onOpponentSide: true,
      },
      "fight:summon",
      {
        handIndex: 1,
        zoneIndex: 2,
        paymentHandIndices: [0],
        onOpponentSide: true,
      },
    ],
    [
      { type: "play_support", handIndex: 0, targetInstanceId: "m1" },
      "fight:play_support",
      { handIndex: 0, targetInstanceId: "m1" },
    ],
    [
      { type: "recycle", handIndex: 3 },
      "fight:recycle_support",
      { handIndex: 3 },
    ],
    [
      { type: "change_mode", instanceId: "m1", mode: "guard" },
      "fight:change_mode",
      { instanceId: "m1", mode: "guard" },
    ],
    [
      { type: "attack", attackerInstanceId: "m1", direct: true },
      "fight:attack",
      { attackerInstanceId: "m1", direct: true },
    ],
    [{ type: "discard", handIndex: 4 }, "fight:discard", { handIndex: 4 }],
    [
      { type: "pick_cards", instanceIds: ["a", "b"] },
      "fight:pick_cards",
      { instanceIds: ["a", "b"] },
    ],
  ])("%o → %s", (action, event, payload) => {
    const { emit, socket: s } = socket();

    emitGameAction(s, 7, action);

    expect(emit).toHaveBeenCalledWith(event, { matchId: 7, ...payload });
  });
});
