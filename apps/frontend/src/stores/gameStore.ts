/**
 * Game Store - Manages game session state
 * Used by FightPage and related components
 * Replaces scattered useState calls in fight components
 */

import { create } from "zustand";
import type { GameState, PlayerStats } from "../types";

export interface GameStoreState {
  // Match state
  matchId: number | null;
  opponentName: string;
  playerStats: PlayerStats | null;

  // Game board state
  gameState: GameState | null;
  status: "idle" | "queued" | "selecting" | "playing" | "finished";

  // Selected elements for actions
  selectedCard: number | null;
  selectedZone: number | null;
  payIndices: number[];

  // Timer
  timeLeft: number;

  // Actions
  setMatchId: (id: number | null) => void;
  setOpponentName: (name: string) => void;
  setPlayerStats: (stats: PlayerStats | null) => void;
  setGameState: (state: GameState | null) => void;
  setStatus: (status: GameStoreState["status"]) => void;
  selectCard: (cardId: number | null) => void;
  selectZone: (zoneId: number | null) => void;
  setPayIndices: (indices: number[]) => void;
  setTimeLeft: (time: number) => void;
  decrementTimeLeft: () => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  matchId: null,
  opponentName: "",
  playerStats: null,
  gameState: null,
  status: "idle" as const,
  selectedCard: null,
  selectedZone: null,
  payIndices: [],
  timeLeft: 90,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setMatchId: (id) => set({ matchId: id }),
  setOpponentName: (name) => set({ opponentName: name }),
  setPlayerStats: (stats) => set({ playerStats: stats }),
  setGameState: (state) => set({ gameState: state }),
  setStatus: (status) => set({ status }),
  selectCard: (cardId) => set({ selectedCard: cardId }),
  selectZone: (zoneId) => set({ selectedZone: zoneId }),
  setPayIndices: (indices) => set({ payIndices: indices }),
  setTimeLeft: (time) => set({ timeLeft: time }),
  decrementTimeLeft: () =>
    set((state) => ({
      timeLeft: Math.max(0, state.timeLeft - 1),
    })),

  reset: () => set(initialState),
}));
