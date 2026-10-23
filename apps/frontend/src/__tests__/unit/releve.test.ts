import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { CardEffect } from "@pipou/shared";
import { releveOptions } from "../../features/fight/releve";
import { useBoardControls } from "../../features/fight/useBoardControls";
import type { GameState } from "../../features/fight/fight.types";
import { monster } from "../fixtures/monster";

const releve2: CardEffect[] = [
  {
    trigger: "PASSIVE",
    condition: null,
    actions: [{ type: "RELEVE", target: "SELF", value: 2 }],
  },
];
const pipou = (id: string) => {
  const m = monster({ instanceId: id });
  m.card.baseCard = { ...m.card.baseCard, archetype: "pipou" };
  return m;
};

describe("releveOptions", () => {
  it("propose la Relève avec assez d'alliés Pipou", () => {
    const zones = [pipou("a"), pipou("b"), pipou("c")];
    expect(releveOptions({ effects: releve2 }, zones, 1)).toMatchObject({
      needed: 2,
      allies: [{ instanceId: "a" }, { instanceId: "b" }, { instanceId: "c" }],
    });
  });

  it("ne la propose pas avec un seul allié Pipou, ni sans Relève", () => {
    expect(
      releveOptions({ effects: releve2 }, [pipou("a"), null, monster()], 1),
    ).toBeNull();
    expect(
      releveOptions({ effects: [] }, [pipou("a"), pipou("b")], 1),
    ).toBeNull();
  });
});

describe("useBoardControls : Relève", () => {
  it("envoie l'invocation avec les alliés sacrifiés, sans paiement", () => {
    const send = vi.fn();
    const gs = {
      me: { monsterZones: [null, null, null] },
    } as unknown as GameState;
    const { result } = renderHook(() => useBoardControls(gs, send));
    act(() => result.current.board.onSetSelectedCard(1));
    act(() => result.current.board.onSummonReleve(0, ["a", "b"]));
    expect(send).toHaveBeenCalledWith({
      type: "summon",
      handIndex: 1,
      zoneIndex: 0,
      paymentHandIndices: [],
      releveInstanceIds: ["a", "b"],
    });
  });
});
