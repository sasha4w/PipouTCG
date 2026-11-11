import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { RankedResultPayload } from "@pipou/shared";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  fightService,
  type PaginatedMatches,
  type PlayerStats,
} from "../../services/fight.service";
import { deckService } from "../../services/deck.service";
import Leaderboard from "./Leaderboard";
import type { Tab } from "./fight.types";

import FightTabBar from "./FightTabBar";
import FightLobby from "./FightLobby";
import MatchHistory from "./MatchHistory";
import FightRules from "./FightRules";
import FightArena from "./FightArena";
import ConfirmActionSheet from "./ConfirmActionSheet";
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
  // `?tab=rules` : retour d'une leçon du tutoriel vers l'onglet Règles
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "rules" ? "rules" : "fight",
  );
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);
  const [confirmingSurrender, setConfirmingSurrender] = useState(false);
  const [ranked, setRanked] = useState<RankedResultPayload | null>(null);
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

  // Même clé que le sélecteur de decks : lu dans le cache, pas de requête en plus.
  const { data: decks } = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
    enabled: selectedDeck !== null,
  });
  const deckName = decks?.find((d) => d.id === selectedDeck)?.name;

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
    onGameOver: (payload) => {
      setRanked(payload.ranked ?? null);
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
    setConfirmingSurrender(false);
    if (matchId) emit("fight:surrender", { matchId });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fp-root">
      {toast && (
        <div className={`fp-toast fp-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {/* Pas d'onglets pendant un combat : l'écran est réservé au plateau */}
      {status !== "playing" && (
        <FightTabBar
          tab={tab}
          onTabChange={setTab}
          selectedDeck={selectedDeck}
          onSelectDeck={setSelectedDeck}
        />
      )}

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
              deckName={deckName}
              opponentName={opponentName}
              userId={userId}
              winner={gameState?.winner}
              endReason={gameState?.endReason}
              onJoinQueue={joinQueue}
              onLeaveQueue={leaveQueue}
              onSubmitDeck={submitDeck}
              ranked={ranked}
              onReplay={() => {
                setRanked(null);
                reset();
              }}
              onPlayAi={() => {
                leaveQueue();
                navigate("/adventure");
              }}
            />
          )}

          {status === "playing" && gameState && (
            <FightArena
              gameState={gameState}
              timeLeft={timeLeft}
              controls={controls}
              onSurrender={() => setConfirmingSurrender(true)}
            />
          )}
        </div>
      )}

      {confirmingSurrender && status === "playing" && (
        <ConfirmActionSheet
          text={{ key: "fight.bar.confirmSurrender", params: {} }}
          onConfirm={surrender}
          onCancel={() => setConfirmingSurrender(false)}
        />
      )}
    </div>
  );
}
