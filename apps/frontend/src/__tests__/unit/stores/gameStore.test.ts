import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../../../stores";

describe("GameStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useGameStore.setState({
      matchId: null,
      opponentName: "",
      playerStats: null,
      gameState: null,
      status: "idle",
      selectedCard: null,
      selectedZone: null,
      payIndices: [],
      timeLeft: 90,
    });
  });

  it("should initialize with default values", () => {
    const state = useGameStore.getState();
    expect(state.matchId).toBeNull();
    expect(state.opponentName).toBe("");
    expect(state.status).toBe("idle");
    expect(state.timeLeft).toBe(90);
  });

  it("should set match ID", () => {
    const { setMatchId } = useGameStore.getState();
    setMatchId(123);
    expect(useGameStore.getState().matchId).toBe(123);

    setMatchId(null);
    expect(useGameStore.getState().matchId).toBeNull();
  });

  it("should set opponent name", () => {
    const { setOpponentName } = useGameStore.getState();
    setOpponentName("Alice");
    expect(useGameStore.getState().opponentName).toBe("Alice");
  });

  it("should set game status", () => {
    const { setStatus } = useGameStore.getState();
    setStatus("playing");
    expect(useGameStore.getState().status).toBe("playing");

    setStatus("finished");
    expect(useGameStore.getState().status).toBe("finished");
  });

  it("should select and deselect card", () => {
    const { selectCard } = useGameStore.getState();
    selectCard(42);
    expect(useGameStore.getState().selectedCard).toBe(42);

    selectCard(null);
    expect(useGameStore.getState().selectedCard).toBeNull();
  });

  it("should select zone", () => {
    const { selectZone } = useGameStore.getState();
    selectZone(3);
    expect(useGameStore.getState().selectedZone).toBe(3);

    selectZone(null);
    expect(useGameStore.getState().selectedZone).toBeNull();
  });

  it("should set pay indices", () => {
    const { setPayIndices } = useGameStore.getState();
    setPayIndices([1, 2, 3]);
    expect(useGameStore.getState().payIndices).toEqual([1, 2, 3]);

    setPayIndices([]);
    expect(useGameStore.getState().payIndices).toEqual([]);
  });

  it("should decrement time left", () => {
    const { setTimeLeft, decrementTimeLeft } = useGameStore.getState();
    setTimeLeft(10);
    decrementTimeLeft();
    expect(useGameStore.getState().timeLeft).toBe(9);

    decrementTimeLeft();
    expect(useGameStore.getState().timeLeft).toBe(8);
  });

  it("should not decrement time below 0", () => {
    const { setTimeLeft, decrementTimeLeft } = useGameStore.getState();
    setTimeLeft(1);
    decrementTimeLeft();
    expect(useGameStore.getState().timeLeft).toBe(0);

    decrementTimeLeft();
    expect(useGameStore.getState().timeLeft).toBe(0);
  });

  it("should reset to initial state", () => {
    const state = useGameStore.getState();
    state.setMatchId(99);
    state.setOpponentName("Bob");
    state.setStatus("playing");
    state.selectCard(5);
    state.setTimeLeft(30);

    state.reset();

    const resetState = useGameStore.getState();
    expect(resetState.matchId).toBeNull();
    expect(resetState.opponentName).toBe("");
    expect(resetState.status).toBe("idle");
    expect(resetState.selectedCard).toBeNull();
    expect(resetState.timeLeft).toBe(90);
  });

  it("should allow multiple concurrent updates", () => {
    const state = useGameStore.getState();
    state.setMatchId(1);
    state.setOpponentName("Charlie");
    state.setStatus("queued");
    state.selectCard(10);
    state.selectZone(2);

    const currentState = useGameStore.getState();
    expect(currentState.matchId).toBe(1);
    expect(currentState.opponentName).toBe("Charlie");
    expect(currentState.status).toBe("queued");
    expect(currentState.selectedCard).toBe(10);
    expect(currentState.selectedZone).toBe(2);
  });
});
