import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameOverPayload } from "@pipou/shared";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconArrowLeft, IconRobot } from "../../components/Icons";
import { userService } from "../../services/user.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import FightArena from "../fight/FightArena";
import { useBoardControls } from "../fight/useBoardControls";
import { useFightConnection } from "../fight/useFightConnection";
import AdventureResult from "./AdventureResult";
import { findOpponent, resumeTarget } from "./adventureView";
import { useAdventureOverview } from "./useAdventureOverview";
import "../fight/FightPage.css";
import "./Adventure.css";

/** Données que la fin d'un combat d'aventure peut changer. */
const AFTER_GAME_KEYS = [
  QUERY_KEYS.adventure,
  QUERY_KEYS.profile,
  QUERY_KEYS.myStats,
  QUERY_KEYS.inventory,
  QUERY_KEYS.collection,
  QUERY_KEYS.achievements,
  QUERY_KEYS.quests,
];

interface Props {
  userId: number;
  opponentId: number;
  deckId: number | null;
}

function AdventureFight({ userId, opponentId, deckId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: overview } = useAdventureOverview();
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // `adventure:start` émis et pas encore tranché par le serveur.
  const startPendingRef = useRef(false);
  // Une partie retrouvée pendant ce lancement : le serveur va le refuser
  // (« déjà une partie en cours »). Ce refus-là est attendu, on le tait.
  const resumedDuringStartRef = useRef(false);
  const startedRef = useRef(false);
  const clearStart = () => {
    startPendingRef.current = false;
    resumedDuringStartRef.current = false;
  };
  // Le plateau a besoin de `send` (connexion) et la connexion de `clearSelection`
  // (plateau) : on relie les deux par une ref.
  const clearSelectionRef = useRef<() => void>(() => {});
  const onState = useCallback(() => {
    startedRef.current = true;
    // Sans reprise, un état répond à notre lancement ; après une reprise, le
    // refus du lancement arrive encore après l'état de la partie reprise.
    if (!resumedDuringStartRef.current) startPendingRef.current = false;
    clearSelectionRef.current();
  }, []);

  const { status, gameState, matchId, timeLeft, toast, emit, send, reset } =
    useFightConnection({
      userId,
      silentMatch: true,
      onState,
      onResumed: (payload) => {
        if (resumedDuringStartRef.current) {
          // Seconde reprise (reconnexion) : le lancement a déjà été tranché
          // sur la connexion précédente, plus aucun refus à taire.
          clearStart();
        } else if (startPendingRef.current) {
          resumedDuringStartRef.current = true;
        }
        const target = resumeTarget(payload, opponentId);
        if (target) navigate(target, { replace: true });
      },
      onError: (message) => {
        const expectedRefusal =
          startPendingRef.current && resumedDuringStartRef.current;
        clearStart();
        if (expectedRefusal) return true;
        if (startedRef.current) return false;
        setStartError(message);
        return true;
      },
      onGameOver: (payload) => {
        clearStart();
        setGameOver(payload);
        for (const queryKey of AFTER_GAME_KEYS)
          queryClient.invalidateQueries({ queryKey });
      },
    });
  const controls = useBoardControls(gameState, send);
  const { clearSelection } = controls;
  useEffect(() => {
    clearSelectionRef.current = clearSelection;
  }, [clearSelection]);

  // Lancement à l'arrivée sur l'écran (émis dès que la socket est connectée)
  const start = useCallback(() => {
    if (deckId === null) return;
    startPendingRef.current = true;
    resumedDuringStartRef.current = false;
    emit("adventure:start", { opponentId, deckId });
  }, [emit, opponentId, deckId]);
  useEffect(start, [start]);

  const found = overview ? findOpponent(overview, opponentId) : null;
  const resultWorld =
    overview?.worlds.find((w) => w.id === gameOver?.adventure?.worldId) ?? found?.world;
  const unlockedWorlds = (gameOver?.adventure?.unlockedWorldIds ?? []).map(
    (id) => overview?.worlds.find((w) => w.id === id)?.name ?? `#${id}`,
  );

  const backToWorld = () => {
    if (!resultWorld) return navigate("/adventure");
    const deck = deckId !== null ? `?deck=${deckId}` : "";
    navigate(`/adventure/${resultWorld.id}${deck}`);
  };

  const replay = () => {
    setGameOver(null);
    setStartError(null);
    startedRef.current = false;
    reset();
    start();
  };

  const surrender = () => {
    if (!matchId || !window.confirm(t("adventure.fight.surrender_confirm"))) return;
    emit("fight:surrender", { matchId });
  };

  const renderWaiting = () => {
    const message =
      startError !== null
        ? t("adventure.fight.failed", { message: startError })
        : deckId === null
          ? t("adventure.fight.no_deck")
          : found
            ? t("adventure.fight.preparing", { name: found.opponent.name })
            : t("adventure.fight.preparing_generic");
    return (
      <div className="adv-fight__wait">
        <IconRobot
          size={48} className={startError === null && deckId !== null ? "adv-pulse" : undefined} />
        <p className={startError !== null ? "adv-msg adv-msg--err" : "adv-msg"}>{message}</p>
        <Button variant="ghost-bordeaux" onClick={backToWorld}>
          <IconArrowLeft size={16} />
          {t("adventure.fight.back")}
        </Button>
      </div>
    );
  };

  return (
    <div className="fp-root adv-fight">
      {toast && <div className={`fp-toast fp-toast--${toast.type}`}>{toast.msg}</div>}

      {gameOver ? (
        <AdventureResult
          result={gameOver.adventure ?? null}
          won={gameOver.adventure?.won ?? gameOver.winner === userId}
          draw={gameOver.winner === null}
          worldOrder={resultWorld?.order ?? null}
          unlockedWorlds={unlockedWorlds}
          onReplay={deckId !== null ? replay : undefined}
          onBack={backToWorld}
        />
      ) : status === "playing" && gameState ? (
        <div className="fp-fight-area">
          <FightArena
            gameState={gameState}
            timeLeft={timeLeft}
            controls={controls}
            onSurrender={surrender}
          />
        </div>
      ) : (
        renderWaiting()
      )}
    </div>
  );
}

/** Route `/adventure/fight/:opponentId?deck=<id>`. */
export default function AdventureFightRoute() {
  const { opponentId } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { data: me, isError } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });

  const id = Number(opponentId);
  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/adventure" replace />;
  if (isError) return <p className="adv-msg adv-msg--err">{t("adventure.error")}</p>;
  if (!me) return <Loading message={t("adventure.loading")} />;
  const deck = Number(searchParams.get("deck"));
  // key : une autre IA (reprise redirigée) repart d'une connexion neuve
  return (
    <AdventureFight
      key={id}
      userId={me.id}
      opponentId={id}
      deckId={Number.isInteger(deck) && deck > 0 ? deck : null}
    />
  );
}
