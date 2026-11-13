import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PuzzleState } from "@pipou/shared";

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

import { usePuzzleSession } from "./usePuzzleSession";

const serverSends = (event: string, payload?: unknown) =>
  act(() => fake.handlers.get(event)?.(payload));

const puzzleState = { puzzleId: 3, outcome: "ongoing" } as PuzzleState;

describe("usePuzzleSession", () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emit.mockClear();
    fake.disconnect.mockClear();
    fake.io.mockClear();
  });

  it("émet puzzle:start à la connexion, et à chaque reconnexion", () => {
    renderHook(() => usePuzzleSession());
    serverSends("connect");
    serverSends("connect");
    expect(fake.emit).toHaveBeenNthCalledWith(1, "puzzle:start", {});
    expect(fake.emit).toHaveBeenNthCalledWith(2, "puzzle:start", {});
  });

  it("transmet le puzzleId du mode test", () => {
    renderHook(() => usePuzzleSession({ puzzleId: 9 }));
    serverSends("connect");
    expect(fake.emit).toHaveBeenCalledWith("puzzle:start", { puzzleId: 9 });
  });

  it("puzzle:state met à jour l'état, efface l'erreur et notifie", () => {
    const onState = vi.fn();
    const { result } = renderHook(() => usePuzzleSession({ onState }));
    serverSends("puzzle:error", { message: "Action impossible." });
    expect(result.current.error).toBe("Action impossible.");
    serverSends("puzzle:state", puzzleState);
    expect(result.current.state).toBe(puzzleState);
    expect(result.current.error).toBeNull();
    expect(onState).toHaveBeenCalledWith(puzzleState);
  });

  it("une erreur en cours de partie s'efface au bout de quelques secondes", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePuzzleSession());
    serverSends("puzzle:state", puzzleState);
    serverSends("puzzle:error", { message: "Aucun défi en cours" });
    expect(result.current.error).toBe("Aucun défi en cours");
    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.error).toBeNull();
    vi.useRealTimers();
  });

  it("une erreur de lancement reste affichée", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePuzzleSession());
    serverSends("puzzle:error", { message: "Aucun défi aujourd'hui." });
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.error).toBe("Aucun défi aujourd'hui.");
    vi.useRealTimers();
  });

  it("puzzle:closed vide l'état", () => {
    const { result } = renderHook(() => usePuzzleSession());
    serverSends("puzzle:state", puzzleState);
    serverSends("puzzle:closed");
    expect(result.current.state).toBeNull();
  });

  it("send, restart et close émettent les bons événements", () => {
    const { result } = renderHook(() => usePuzzleSession());
    result.current.send({ type: "end_phase" });
    result.current.restart();
    result.current.close();
    expect(fake.emit).toHaveBeenCalledWith("puzzle:action", {
      type: "end_phase",
    });
    expect(fake.emit).toHaveBeenCalledWith("puzzle:restart");
    expect(fake.emit).toHaveBeenCalledWith("puzzle:close");
  });

  it("ne recrée pas la socket quand onState change", () => {
    const { rerender } = renderHook(() =>
      usePuzzleSession({ onState: () => {} }),
    );
    rerender();
    expect(fake.io).toHaveBeenCalledTimes(1);
  });

  it("au démontage : puzzle:close puis déconnexion", () => {
    const { unmount } = renderHook(() => usePuzzleSession());
    unmount();
    expect(fake.emit).toHaveBeenCalledWith("puzzle:close");
    expect(fake.disconnect).toHaveBeenCalled();
  });
});
