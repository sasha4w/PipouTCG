import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  fightService,
  type PaginatedMatches,
  type PlayerStats,
} from "../../services/fight.service";
import Leaderboard from "./Leaderboard";
import type { Tab, GameState } from "./fight.types";
import FightTabBar from "./FightTabBar";
import FightLobby from "./FightLobby";
import MatchHistory from "./MatchHistory";
import FightBoard from "./FightBoard";
import "./FightPage.css";

export default function FightPage({
  userId,
  username,
}: {
  userId: number;
  username: string;
}) {
  const [tab, setTab] = useState<Tab>("fight");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<
    "idle" | "queued" | "selecting" | "playing" | "finished"
  >("idle");
  const [matchId, setMatchId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [payIndices, setPayIndices] = useState<number[]>([]);
  const [toast, setToast] = useState<{
    msg: string;
    type: "err" | "ok";
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: history, refetch: refetchHistory } = useQuery<PaginatedMatches>(
    {
      queryKey: QUERY_KEYS.fightHistory,
      queryFn: () => fightService.getMyHistory(),
      enabled: tab === "history",
    },
  );

  const myStats = useQuery<PlayerStats>({
    queryKey: QUERY_KEYS.fightStats,
    queryFn: () => fightService.getMyStats(),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── Socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(`${import.meta.env.VITE_API_URL}/fight`, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("fight:queued", () => setStatus("queued"));
    socket.on("fight:dequeued", () => setStatus("idle"));
    socket.on(
      "fight:matched",
      ({
        matchId: mid,
        opponentName: oName,
      }: {
        matchId: number;
        opponentName: string;
      }) => {
        setMatchId(mid);
        setOpponentName(oName);
        setStatus("selecting");
        showToast(`⚔️ Adversaire trouvé : ${oName} !`, "ok");
      },
    );
    socket.on("fight:deck_accepted", () =>
      showToast("Deck accepté — en attente de l'adversaire…"),
    );
    socket.on("fight:state", (state: GameState) => {
      console.log("STATE RECU 👉", state);
      setGameState(state);
      setStatus("playing");
      setSelectedCard(null);
      setSelectedZone(null);
      setPayIndices([]);
      if (state.isMyTurn) startCountdown();
    });
    socket.on(
      "fight:game_over",
      ({ winner, endReason }: { winner: number; endReason: string }) => {
        setStatus("finished");
        if (timerRef.current) clearInterval(timerRef.current);
        showToast(
          winner === userId
            ? `🎉 Victoire ! (${endReason})`
            : `💀 Défaite… (${endReason})`,
          winner === userId ? "ok" : "err",
        );
        setTimeout(() => refetchHistory(), 2000);
      },
    );
    socket.on("fight:error", ({ message }: { message: string }) =>
      showToast(message, "err"),
    );

    return () => {
      socket.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, showToast, startCountdown, refetchHistory]);

  // ── Emit helper ───────────────────────────────────────────────────────────

  const emit = useCallback((event: string, data: object) => {
    socketRef.current?.emit(event, data);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const joinQueue = () => emit("fight:queue", {});

  const leaveQueue = () => {
    emit("fight:dequeue", {});
    setStatus("idle");
  };

  const submitDeck = () => {
    if (!selectedDeck || !matchId) return;
    emit("fight:submit_deck", { matchId, deckId: selectedDeck });
  };

  const endPhase = () => matchId && emit("fight:end_phase", { matchId });

  const surrender = () => {
    if (!matchId || !window.confirm("Abandonner ?")) return;
    emit("fight:surrender", { matchId });
  };

  const summon = () => {
    if (selectedCard === null || selectedZone === null || !matchId) return;
    emit("fight:summon", {
      matchId,
      handIndex: selectedCard,
      zoneIndex: selectedZone,
      paymentHandIndices: payIndices,
    });
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  };

  const attackMonster = (targetInstanceId: string) => {
    if (selectedZone === null || !matchId || !gameState) return;
    const attacker = gameState.me.monsterZones[selectedZone];
    if (!attacker) return;
    emit("fight:attack", {
      matchId,
      attackerInstanceId: attacker.instanceId,
      targetInstanceId,
    });
    setSelectedZone(null);
  };

  const directAttack = () => {
    if (selectedZone === null || !matchId || !gameState) return;
    const attacker = gameState.me.monsterZones[selectedZone];
    if (!attacker) return;
    emit("fight:attack", {
      matchId,
      attackerInstanceId: attacker.instanceId,
      direct: true,
    });
    setSelectedZone(null);
  };

  const changeMode = (instanceId: string, mode: "attack" | "guard") =>
    matchId && emit("fight:change_mode", { matchId, instanceId, mode });

  const recycleFromHand = (handIndex: number) =>
    matchId && emit("fight:recycle_support", { matchId, handIndex });

  const playSupport = (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => {
    if (!matchId) return;
    emit("fight:play_support", {
      matchId,
      handIndex,
      ...(zoneIndex !== undefined && { zoneIndex }),
      ...(targetInstanceId !== undefined && { targetInstanceId }),
    });
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  };

  const discardCard = (handIndex: number) => {
    if (!matchId) return;
    emit("fight:discard", { matchId, handIndex });
  };

  const handleReplay = () => {
    setStatus("idle");
    setGameState(null);
    setMatchId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fp-root">
      {toast && (
        <div className={`fp-toast fp-toast--${toast.type}`}>{toast.msg}</div>
      )}

      <FightTabBar
        tab={tab}
        onTabChange={setTab}
        selectedDeck={selectedDeck}
        onSelectDeck={setSelectedDeck}
      />

      {tab === "leaderboard" && (
        <div className="fp-section">
          <Leaderboard myUserId={userId} />
        </div>
      )}

      {tab === "history" && (
        <MatchHistory
          history={history}
          myStats={myStats.data}
          username={username}
          myUserId={userId}
        />
      )}

      {tab === "fight" && (
        <div className="fp-fight-area">
          {status !== "playing" && (
            <FightLobby
              status={status}
              selectedDeck={selectedDeck}
              opponentName={opponentName}
              userId={userId}
              winner={gameState?.winner}
              endReason={gameState?.endReason}
              onJoinQueue={joinQueue}
              onLeaveQueue={leaveQueue}
              onSubmitDeck={submitDeck}
              onReplay={handleReplay}
            />
          )}

          {status === "playing" && gameState && (
            <FightBoard
              gs={gameState}
              selectedCard={selectedCard}
              selectedZone={selectedZone}
              payIndices={payIndices}
              timeLeft={timeLeft}
              onSetSelectedCard={setSelectedCard}
              onSetSelectedZone={setSelectedZone}
              onSetPayIndices={setPayIndices}
              onAttackMonster={attackMonster}
              onDirectAttack={directAttack}
              onSummon={summon}
              onPlaySupport={playSupport}
              onChangeMode={changeMode}
              onRecycleSupport={recycleFromHand}
              onDiscardCard={discardCard}
              onEndPhase={endPhase}
              onSurrender={surrender}
            />
          )}
        </div>
      )}
    </div>
  );
}
