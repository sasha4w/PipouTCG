import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { GameOverPayload } from "@pipou/shared";
import type { GameState } from "./fight.types";

type Handler = (payload?: unknown) => void;
const fake = vi.hoisted(() => ({
  handlers: new Map<string, (payload?: unknown) => void>(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  io: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: fake.io.mockImplementation(() => ({
    on: (event: string, h: Handler) => fake.handlers.set(event, h),
    emit: fake.emit,
    disconnect: fake.disconnect,
  })),
}));

import { useFightConnection } from "./useFightConnection";

const serverSends = (event: string, payload?: unknown) =>
  act(() => fake.handlers.get(event)?.(payload));

describe("useFightConnection", () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emit.mockClear();
    fake.disconnect.mockClear();
    fake.io.mockClear();
  });

  it("passe en selecting avec le matchId sur fight:matched", () => {
    const onMatched = vi.fn();
    const { result } = renderHook(() =>
      useFightConnection({ userId: 1, onMatched }),
    );
    expect(result.current.status).toBe("idle");
    const payload = { matchId: 7, opponentName: "Bob" };
    serverSends("fight:matched", payload);
    expect(result.current.status).toBe("selecting");
    expect(result.current.matchId).toBe(7);
    expect(result.current.opponentName).toBe("Bob");
    expect(onMatched).toHaveBeenCalledWith(payload);
  });

  it("passe en playing sur fight:state", () => {
    const { result } = renderHook(() => useFightConnection({ userId: 1 }));
    const state = { isMyTurn: false } as GameState;
    serverSends("fight:state", state);
    expect(result.current.status).toBe("playing");
    expect(result.current.gameState).toBe(state);
  });

  it("passe en finished sur fight:game_over et notifie", () => {
    const onGameOver = vi.fn();
    const { result } = renderHook(() =>
      useFightConnection({ userId: 1, onGameOver }),
    );
    const payload: GameOverPayload = { winner: 1, endReason: "surrender" };
    serverSends("fight:game_over", payload);
    expect(result.current.status).toBe("finished");
    expect(onGameOver).toHaveBeenCalledWith(payload);
  });

  it("ne recrée pas la socket quand les callbacks changent", () => {
    const { rerender } = renderHook(() =>
      useFightConnection({ userId: 1, onGameOver: () => {} }),
    );
    rerender();
    rerender();
    expect(fake.io).toHaveBeenCalledTimes(1);
  });

  it("affiche un toast sur fight:matched en JcJ", () => {
    const { result } = renderHook(() => useFightConnection({ userId: 1 }));
    serverSends("fight:matched", { matchId: 7, opponentName: "Bob" });
    expect(result.current.toast?.msg).toContain("Bob");
  });

  it("silentMatch : pas de toast de mise en relation, de reprise ni de fin", () => {
    const { result } = renderHook(() =>
      useFightConnection({ userId: 1, silentMatch: true }),
    );
    serverSends("fight:matched", { matchId: 7, opponentName: "IA" });
    expect(result.current.toast).toBeNull();
    serverSends("fight:resumed", { matchId: 7, opponentName: "IA" });
    expect(result.current.toast).toBeNull();
    serverSends("fight:game_over", { winner: 1, endReason: "primes_depleted" });
    expect(result.current.toast).toBeNull();
  });

  it("reprend la partie sur fight:resumed et notifie", () => {
    const onResumed = vi.fn();
    const { result } = renderHook(() =>
      useFightConnection({ userId: 1, onResumed }),
    );
    const payload = { matchId: 9, opponentName: "IA", adventureOpponentId: 3 };
    serverSends("fight:resumed", payload);
    expect(result.current.status).toBe("selecting");
    expect(result.current.matchId).toBe(9);
    expect(result.current.opponentName).toBe("IA");
    expect(onResumed).toHaveBeenCalledWith(payload);
  });

  it("garde le statut playing si fight:state est déjà arrivé avant fight:resumed", () => {
    const { result } = renderHook(() => useFightConnection({ userId: 1 }));
    serverSends("fight:state", { isMyTurn: false } as GameState);
    serverSends("fight:resumed", { matchId: 9, opponentName: "IA" });
    expect(result.current.status).toBe("playing");
  });

  it("onError peut prendre en charge une erreur (pas de toast)", () => {
    const onError = vi.fn((message: string) => message === "déjà");
    const { result } = renderHook(() =>
      useFightConnection({ userId: 1, onError }),
    );
    serverSends("fight:error", { message: "déjà" });
    expect(onError).toHaveBeenCalledWith("déjà");
    expect(result.current.toast).toBeNull();
    serverSends("fight:error", { message: "autre" });
    expect(result.current.toast).toEqual({ msg: "autre", type: "err" });
  });
});
