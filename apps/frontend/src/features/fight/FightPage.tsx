import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  fightService,
  type PaginatedMatches,
  type PlayerStats,
} from "../../services/fight.service";
import Leaderboard from "./Leaderboard";
import type { Tab } from "./fight.types";

import FightTabBar from "./FightTabBar";
import FightLobby from "./FightLobby";
import MatchHistory from "./MatchHistory";
import FightRules from "./FightRules";
import FightArena from "./FightArena";
import { useBoardControls } from "./useBoardControls";
import { useFightConnection } from "./useFightConnection";
import { pvpResumeTarget } from "../adventure/adventureView";
import "./FightPage.css";

export default function FightPage({
  userId,
  username,
}: {
  userId: number;
  username: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("fight");
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);
  // Le plateau a besoin de `send` (connexion) et la connexion de `clearSelection`
  // (plateau) : on relie les deux par une ref.
  const clearSelectionRef = useRef<() => void>(() => {});
  const onState = useCallback(() => clearSelectionRef.current(), []);

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

  // ── Connexion et plateau ──────────────────────────────────────────────────

  const {
    status,
    gameState,
    matchId,
    opponentName,
    timeLeft,
    toast,
    emit,
    send,
    reset,
  } = useFightConnection({
    userId,
    onState,
    // Partie contre une IA retrouvée : elle se joue sur l'écran d'aventure.
    onResumed: (payload) => {
      const target = pvpResumeTarget(payload);
      if (target) navigate(target, { replace: true });
    },
    onGameOver: () => {
      setTimeout(() => refetchHistory(), 2000);
    },
  });
  const controls = useBoardControls(gameState, send);
  const { clearSelection } = controls;
  useEffect(() => {
    clearSelectionRef.current = clearSelection;
  }, [clearSelection]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const joinQueue = () => emit("fight:queue", {});
  const leaveQueue = () => {
    emit("fight:dequeue", {});
    reset();
  };

  const submitDeck = () => {
    if (!selectedDeck || !matchId) return;
    emit("fight:submit_deck", { matchId, deckId: selectedDeck });
  };

  const surrender = () => {
    if (!matchId || !window.confirm(t("fight.bar.confirmSurrender"))) return;
    emit("fight:surrender", { matchId });
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
      {tab === "rules" && (
        <div className="fp-section">
          <FightRules />
        </div>
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
              onReplay={reset}
            />
          )}

          {status === "playing" && gameState && (
            <FightArena
              gameState={gameState}
              timeLeft={timeLeft}
              controls={controls}
              onSurrender={surrender}
            />
          )}
        </div>
      )}
    </div>
  );
}
