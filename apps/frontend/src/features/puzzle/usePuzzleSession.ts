import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  PUZZLE_NAMESPACE,
  type GameAction,
  type PuzzleClientEvents,
  type PuzzleServerEvents,
  type PuzzleState,
} from "@pipou/shared";
import { getAuthToken } from "../../api/authToken";

type PuzzleSocket = Socket<PuzzleServerEvents, PuzzleClientEvents>;

/** Durée d'affichage d'une erreur serveur avant qu'elle ne s'efface. */
const ERROR_MS = 3000;

interface Options {
  /** Admin seulement : teste ce défi. Absent : défi du jour. */
  puzzleId?: number;
  /** Appelé à chaque nouvel état reçu (efface la sélection, invalide les requêtes…). */
  onState?: (state: PuzzleState) => void;
}

/** Partie de défi : socket du namespace /puzzle, état courant et actions. */
export function usePuzzleSession({ puzzleId, onState }: Options = {}): {
  state: PuzzleState | null;
  /** Dernier puzzle:error, effacé au prochain état ou, en cours de partie, après quelques secondes. */
  error: string | null;
  send: (action: GameAction) => void;
  restart: () => void;
  close: () => void;
} {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<PuzzleSocket | null>(null);
  // Une erreur de lancement (aucun état reçu) reste affichée ; les suivantes s'effacent
  const hasStateRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Lu via une ref : changer de callback ne doit pas recréer la socket
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    const socket: PuzzleSocket = io(
      `${import.meta.env.VITE_API_URL}${PUZZLE_NAMESPACE}`,
      {
        withCredentials: true,
        // Repli quand le cookie tiers est bloqué (Opera GX, Safari)
        auth: (cb) => cb({ token: getAuthToken() }),
        transports: ["websocket"],
      },
    );
    socketRef.current = socket;
    hasStateRef.current = false;

    // À chaque connexion, reconnexions comprises : le serveur reprend la partie
    socket.on("connect", () => {
      socket.emit("puzzle:start", puzzleId === undefined ? {} : { puzzleId });
    });
    socket.on("puzzle:state", (next) => {
      clearTimeout(errorTimerRef.current);
      hasStateRef.current = true;
      setError(null);
      setState(next);
      onStateRef.current?.(next);
    });
    socket.on("puzzle:closed", () => {
      hasStateRef.current = false;
      setState(null);
    });
    socket.on("puzzle:error", ({ message }) => {
      clearTimeout(errorTimerRef.current);
      setError(message);
      if (hasStateRef.current)
        errorTimerRef.current = setTimeout(() => setError(null), ERROR_MS);
    });

    return () => {
      clearTimeout(errorTimerRef.current);
      socket.emit("puzzle:close");
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [puzzleId]);

  const send = useCallback((action: GameAction) => {
    socketRef.current?.emit("puzzle:action", action);
  }, []);
  const restart = useCallback(() => {
    socketRef.current?.emit("puzzle:restart");
  }, []);
  const close = useCallback(() => {
    socketRef.current?.emit("puzzle:close");
  }, []);

  return { state, error, send, restart, close };
}
