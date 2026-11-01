import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { getAuthToken } from "../../api/authToken";
import {
  FIGHT_NAMESPACE,
  type ClientToServerEvents,
  type GameAction,
  type GameOverPayload,
  type MatchFoundPayload,
} from "@pipou/shared";
// i18n plutôt que useTranslation : `t` relancerait la socket à chaque changement de langue
import i18n from "../../i18n";
import type { GameState, FightClientSocket } from "./fight.types";
import { emitGameAction } from "./emitGameAction";

export type FightStatus =
  "idle" | "queued" | "selecting" | "playing" | "finished";

export interface FightToast {
  msg: string;
  type: "err" | "ok";
}

interface FightConnectionOptions {
  userId: number;
  onMatched?: (payload: MatchFoundPayload) => void;
  onResumed?: (payload: MatchFoundPayload) => void;
  onGameOver?: (payload: GameOverPayload) => void;
  /** Appelé à chaque `fight:state` (ex. vider les sélections du plateau). */
  onState?: (state: GameState) => void;
  /**
   * Erreur du serveur : renvoyer true pour la prendre en charge (pas de toast).
   * Ex. le refus de `adventure:start` quand une partie a été reprise.
   */
  onError?: (message: string) => boolean;
  /**
   * Combat d'aventure : pas de toast de mise en relation, de reprise ni de fin
   * de partie (l'écran d'aventure affiche lui-même l'adversaire et le résultat).
   */
  silentMatch?: boolean;
}

/**
 * Connexion au namespace /fight : socket, état de la partie, compte à rebours
 * du tour et toast. Partagée par le duel JcJ et le combat d'aventure.
 * Les callbacks sont lus via des refs : changer leur identité ne recrée pas la socket.
 */
export function useFightConnection({
  userId,
  onMatched,
  onResumed,
  onGameOver,
  onState,
  onError,
  silentMatch = false,
}: FightConnectionOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<FightStatus>("idle");
  const [matchId, setMatchId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [toast, setToast] = useState<FightToast | null>(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const socketRef = useRef<FightClientSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const callbacksRef = useRef({
    onMatched,
    onResumed,
    onGameOver,
    onState,
    onError,
    silentMatch,
  });
  useEffect(() => {
    callbacksRef.current = {
      onMatched,
      onResumed,
      onGameOver,
      onState,
      onError,
      silentMatch,
    };
  });

  const showToast = useCallback((msg: string, type: "err" | "ok" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const startCountdown = useCallback(() => {
    setTimeLeft(90);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    const socket: FightClientSocket = io(
      `${import.meta.env.VITE_API_URL}${FIGHT_NAMESPACE}`,
      {
        withCredentials: true,
        // Repli quand le cookie tiers est bloqué (Opera GX, Safari)
        auth: (cb) => cb({ token: getAuthToken() }),
        transports: ["websocket"],
      },
    );
    socketRef.current = socket;

    socket.on("fight:queued", () => setStatus("queued"));
    socket.on("fight:dequeued", () => setStatus("idle"));
    socket.on("fight:matched", (payload) => {
      setMatchId(payload.matchId);
      setOpponentName(payload.opponentName);
      setStatus("selecting");
      if (!callbacksRef.current.silentMatch)
        showToast(
          `⚔️ ${i18n.t("fight.toast.matched", { name: payload.opponentName })}`,
          "ok",
        );
      callbacksRef.current.onMatched?.(payload);
    });
    socket.on("fight:resumed", (payload) => {
      setMatchId(payload.matchId);
      setOpponentName(payload.opponentName);
      // fight:state suit si la partie a commencé ; sinon on revient au choix du deck
      setStatus((s) => (s === "playing" ? s : "selecting"));
      if (!callbacksRef.current.silentMatch)
        showToast(`🔌 ${i18n.t("fight.toast.resumed")}`, "ok");
      callbacksRef.current.onResumed?.(payload);
    });
    socket.on("fight:deck_accepted", () =>
      showToast(i18n.t("fight.toast.deckAccepted")),
    );
    socket.on("fight:state", (state: GameState) => {
      setGameState(state);
      setStatus("playing");
      callbacksRef.current.onState?.(state);
      if (state.isMyTurn) startCountdown();
    });
    socket.on("fight:game_over", (payload) => {
      const { winner, endReason } = payload;
      const reason = i18n.t(`fight.endReason.${endReason}`, {
        defaultValue: endReason,
      });
      setStatus("finished");
      if (timerRef.current) clearInterval(timerRef.current);
      callbacksRef.current.onGameOver?.(payload);
      if (callbacksRef.current.silentMatch) return;
      if (winner === null) {
        showToast(`🤝 ${i18n.t("fight.toast.draw", { reason })}`, "ok");
      } else {
        showToast(
          winner === userId
            ? `🎉 ${i18n.t("fight.toast.win", { reason })}`
            : `💀 ${i18n.t("fight.toast.loss", { reason })}`,
          winner === userId ? "ok" : "err",
        );
      }
    });
    socket.on("fight:error", ({ message }) => {
      if (callbacksRef.current.onError?.(message)) return;
      showToast(message, "err");
    });

    return () => {
      socket.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, showToast, startCountdown]);

  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ) => {
      socketRef.current?.emit(event, ...args);
    },
    [],
  );

  const send = useCallback(
    (action: GameAction) => {
      if (socketRef.current && matchId)
        emitGameAction(socketRef.current, matchId, action);
    },
    [matchId],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setGameState(null);
    setMatchId(null);
  }, []);

  return {
    status,
    gameState,
    matchId,
    opponentName,
    timeLeft,
    toast,
    emit,
    send,
    reset,
  };
}
