/**
 * useGameSession - Game session management hook for FightPage
 * Extracted from FightPage.tsx to manage game state logic
 * Uses gameStore from Zustand for centralized state
 */

import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "../../../stores";
import type { GameState } from "../../../types";

export function useGameSession() {
  const {
    matchId,
    opponentName,
    gameState,
    status,
    selectedCard,
    selectedZone,
    payIndices,
    timeLeft,
    setMatchId,
    setOpponentName,
    setGameState,
    setStatus,
    selectCard,
    selectZone,
    setPayIndices,
    setTimeLeft,
    decrementTimeLeft,
    reset,
  } = useGameStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start timer
  useEffect(() => {
    if (status === "playing" && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        decrementTimeLeft();
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [status, timeLeft, decrementTimeLeft]);

  // Reset timer when status changes
  useEffect(() => {
    if (status !== "playing" && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [status]);

  // Action handlers
  const joinQueue = useCallback(() => {
    setStatus("queued");
    setTimeLeft(90);
  }, [setStatus, setTimeLeft]);

  const submitDeck = useCallback((_deckId: number) => {
    setStatus("selecting");
  }, [setStatus]);

  const startMatch = useCallback((matchData: any) => {
    setMatchId(matchData.id);
    setOpponentName(matchData.opponent.username);
    setStatus("playing");
    setGameState(matchData.gameState);
    setTimeLeft(90);
  }, [setMatchId, setOpponentName, setStatus, setGameState, setTimeLeft]);

  const updateGameState = useCallback((newState: GameState) => {
    setGameState(newState);
  }, [setGameState]);

  const surrender = useCallback(() => {
    setStatus("finished");
    reset();
  }, [setStatus, reset]);

  const endTurn = useCallback(() => {
    // Turn handling via socket typically
    setTimeLeft(90);
    selectCard(null);
    selectZone(null);
  }, [setTimeLeft, selectCard, selectZone]);

  return {
    // State
    matchId,
    opponentName,
    gameState,
    status,
    selectedCard,
    selectedZone,
    payIndices,
    timeLeft,

    // Methods
    joinQueue,
    submitDeck,
    startMatch,
    updateGameState,
    selectCard,
    selectZone,
    setPayIndices,
    endTurn,
    surrender,

    // Getters
    isPlaying: status === "playing",
    isQueued: status === "queued",
    isFinished: status === "finished",
  };
}
