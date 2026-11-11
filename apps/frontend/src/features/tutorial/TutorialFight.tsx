import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameOverPayload, TutorialLessonId } from "@pipou/shared";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconArrowLeft, IconScroll } from "../../components/Icons";
import { userService } from "../../services/user.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import FightArena from "../fight/FightArena";
import { useBoardControls } from "../fight/useBoardControls";
import { useFightConnection } from "../fight/useFightConnection";
import TutorialCoach from "./TutorialCoach";
import TutorialResult from "./TutorialResult";
import {
  lessonPath,
  lessonResumeTarget,
  nextLesson,
  parseLessonId,
} from "./tutorialView";
import "../fight/FightPage.css";
import "./Tutorial.css";

/** Données que la fin d'une leçon peut changer. */
const AFTER_LESSON_KEYS = [
  QUERY_KEYS.tutorial,
  QUERY_KEYS.profile,
  QUERY_KEYS.achievements,
];

interface Props {
  userId: number;
  lessonId: TutorialLessonId;
}

function TutorialFight({ userId, lessonId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // `tutorial:start` émis et pas encore tranché ; une leçon retrouvée à la
  // connexion fait refuser ce lancement, refus attendu que l'on tait.
  const startPendingRef = useRef(false);
  const resumedDuringStartRef = useRef(false);
  const startedRef = useRef(false);
  const clearSelectionRef = useRef<() => void>(() => {});
  const clearStart = () => {
    startPendingRef.current = false;
    resumedDuringStartRef.current = false;
  };
  const onState = useCallback(() => {
    startedRef.current = true;
    if (!resumedDuringStartRef.current) startPendingRef.current = false;
    clearSelectionRef.current();
  }, []);

  const { status, gameState, matchId, toast, emit, send, reset } =
    useFightConnection({
      userId,
      silentMatch: true,
      onState,
      onResumed: (payload) => {
        if (resumedDuringStartRef.current) clearStart();
        else if (startPendingRef.current) resumedDuringStartRef.current = true;
        const target = lessonResumeTarget(payload, lessonId);
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
        for (const queryKey of AFTER_LESSON_KEYS)
          queryClient.invalidateQueries({ queryKey });
      },
    });
  const controls = useBoardControls(gameState, send);
  const { clearSelection } = controls;
  useEffect(() => {
    clearSelectionRef.current = clearSelection;
  }, [clearSelection]);

  const start = useCallback(() => {
    startPendingRef.current = true;
    resumedDuringStartRef.current = false;
    emit("tutorial:start", { lessonId });
  }, [emit, lessonId]);
  useEffect(start, [start]);

  const backToLessons = () => navigate("/fight?tab=rules");

  const replay = () => {
    setGameOver(null);
    setStartError(null);
    startedRef.current = false;
    reset();
    start();
  };

  const quit = () => {
    if (!matchId || !window.confirm(t("tutorial.ui.quitConfirm"))) return;
    emit("fight:surrender", { matchId });
  };

  const next = nextLesson(lessonId);
  const step = gameState?.tutorial;

  return (
    <div className="fp-root tut-fight">
      {toast && (
        <div className={`fp-toast fp-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {gameOver ? (
        <TutorialResult
          result={gameOver.tutorial ?? null}
          hasNext={next !== null}
          onNext={() => next && navigate(lessonPath(next), { replace: true })}
          onReplay={replay}
          onBack={backToLessons}
        />
      ) : status === "playing" && gameState ? (
        <div className="fp-fight-area">
          {step && (
            <TutorialCoach
              step={step}
              onNext={() =>
                emit("tutorial:ack", { matchId: gameState.matchId })
              }
              onQuit={quit}
            />
          )}
          <FightArena
            gameState={gameState}
            timeLeft={null}
            controls={controls}
            onSurrender={quit}
            coach={step?.hint}
          />
        </div>
      ) : (
        <div className="tut-wait">
          <IconScroll size={48} />
          <p className={startError !== null ? "tut-error" : undefined}>
            {startError ?? t("tutorial.ui.starting")}
          </p>
          <Button variant="ghost-bordeaux" onClick={backToLessons}>
            <IconArrowLeft size={16} />
            {t("tutorial.ui.backToLessons")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Route `/tutorial/:lessonId`. */
export default function TutorialFightRoute() {
  const { lessonId } = useParams();
  const { t } = useTranslation();
  const { data: me, isError } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });

  const id = parseLessonId(lessonId);
  if (!id) return <Navigate to="/fight?tab=rules" replace />;
  if (isError) return <p className="tut-error">{t("tutorial.ui.loadError")}</p>;
  if (!me) return <Loading message={t("tutorial.ui.starting")} />;
  // key : une autre leçon (reprise redirigée) repart d'une connexion neuve
  return <TutorialFight key={id} userId={me.id} lessonId={id} />;
}
