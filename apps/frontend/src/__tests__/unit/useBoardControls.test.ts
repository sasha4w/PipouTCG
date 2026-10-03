import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBoardControls } from "../../features/fight/useBoardControls";
import type { GameState } from "../../features/fight/fight.types";

const gs = {
  me: { monsterZones: [null, { instanceId: "attaquant" }, null] },
} as unknown as GameState;

describe("useBoardControls", () => {
  it("invoque la carte sélectionnée sur la zone choisie, puis vide la sélection", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => {
      result.current.board.onSetSelectedCard(2);
      result.current.board.onSetSelectedZone(0);
      result.current.board.onSetPayIndices([1]);
    });
    act(() => result.current.board.onSummon());

    expect(send).toHaveBeenCalledWith({
      type: "summon",
      handIndex: 2,
      zoneIndex: 0,
      paymentHandIndices: [1],
    });
    expect(result.current.board.selectedCard).toBeNull();
    expect(result.current.board.payIndices).toEqual([]);
  });

  it("attaque avec le monstre de la zone sélectionnée", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => result.current.board.onSetSelectedZone(1));
    act(() => result.current.board.onAttackMonster("cible"));

    expect(send).toHaveBeenCalledWith({
      type: "attack",
      attackerInstanceId: "attaquant",
      targetInstanceId: "cible",
    });
  });

  it("n'envoie rien sans carte sélectionnée", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => result.current.board.onSummonZeta(1));

    expect(send).not.toHaveBeenCalled();
  });
});
