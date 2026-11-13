import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PuzzleState } from "@pipou/shared";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconArrowLeft, IconUndo } from "../../components/Icons";
import { QUERY_KEYS } from "../../utils/querykeys";
import FightArena from "../fight/FightArena";
import ConfirmActionSheet from "../fight/ConfirmActionSheet";
import { phaseOptions } from "../fight/phaseOptions";
import { useBoardControls } from "../fight/useBoardControls";
import PuzzleObjectiveBanner from "./PuzzleObjectiveBanner";
import PuzzleResult from "./PuzzleResult";
import { PUZZLE_PATH } from "./puzzleView";
import { usePuzzleSession } from "./usePuzzleSession";
import "../fight/FightPage.css";
import "./Puzzle.css";

/** Délai avant l'écran de fin : le temps des animations du plateau. */
const RESULT_DELAY_MS = 900;

/** Données que le gain d'une première résolution peut changer. */
const AFTER_SOLVE_KEYS = [
  QUERY_KEYS.puzzleToday,
  QUERY_KEYS.profile,
  QUERY_KEYS.inventory,
  QUERY_KEYS.quests,
  QUERY_KEYS.achievements,
];

interface Props {
  /** Admin seulement : teste ce défi (aucune récompense). */
  puzzleId?: number;
}

/** Partie de défi : plateau, bandeau d'objectif, barre d'actions et résultat. */
export function PuzzlePlay({ puzzleId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Le plateau a besoin de `send` (session) et la session de `clearSelection`
  // (plateau) : on relie les deux par une ref.
  const clearSelectionRef = useRef<() => void>(() => {});
  const onState = useCallback(
    (next: PuzzleState) => {
      clearSelectionRef.current();
      if (next.reward?.firstSolve) {
        for (const queryKey of AFTER_SOLVE_KEYS)
          void queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient],
  );
  const { state, error, send, restart } = usePuzzleSession({
    puzzleId,
    onState,
  });
  const controls = useBoardControls(state?.view ?? null, send);
  const { clearSelection } = controls;
  useEffect(() => {
    clearSelectionRef.current = clearSelection;
  }, [clearSelection]);

  // Écran de fin : l'état pour lequel il est révélé, comparé à l'état courant
  // (un nouvel état, ex. « Recommencer », le masque sans rien réinitialiser).
  const [revealed, setRevealed] = useState<PuzzleState | null>(null);
  useEffect(() => {
    if (!state || state.outcome === "ongoing") return;
    const id = setTimeout(() => setRevealed(state), RESULT_DELAY_MS);
    return () => clearTimeout(id);
  }, [state]);

  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const back = () => navigate(PUZZLE_PATH);

  if (!state) {
    return (
      <div className="fp-root pz-session">
        {error ? (
          <div className="pz-session__wait">
            <p className="pz-msg" role="alert">
              {error}
            </p>
            <Button variant="ghost-bordeaux" onClick={back}>
              <IconArrowLeft size={16} />
              {t("puzzle.session.quit")}
            </Button>
          </div>
        ) : (
          <Loading message={t("puzzle.session.loading")} />
        )}
      </div>
    );
  }

  const { view, outcome } = state;
  const ongoing = outcome === "ongoing";
  const endTurn = phaseOptions(view.phase, view.me.hand.length).find(
    (o) => o.target === "endTurn",
  );
  const canEndTurn =
    ongoing &&
    view.isMyTurn &&
    !view.pendingChoice &&
    !!endTurn &&
    !endTurn.disabledReason;

  // Un `end_phase` par étape jusqu'à la fin du tour, sans jamais revenir en arrière
  const endTurnNow = () => {
    setConfirmingEnd(false);
    for (let i = 0; i < (endTurn?.steps ?? 0); i++) send({ type: "end_phase" });
  };

  return (
    <div className="fp-root pz-session">
      {/* Une erreur du serveur ne compte plus une fois le défi terminé (coups en trop) */}
      {error && ongoing && <div className="fp-toast fp-toast--err">{error}</div>}

      <PuzzleObjectiveBanner objective={state.objective} test={state.test} />

      <div className="fp-fight-area">
        <FightArena
          gameState={view}
          timeLeft={null}
          controls={controls}
          highlightInstanceId={state.objective.targetInstanceId}
        />
      </div>

      <div className="pz-bar">
        <button type="button" className="pz-bar__btn" onClick={back}>
          <IconArrowLeft size={16} />
          {t("puzzle.session.quit")}
        </button>
        <button type="button" className="pz-bar__btn" onClick={restart}>
          <IconUndo size={16} />
          {t("puzzle.session.restart")}
        </button>
        <button
          type="button"
          className="pz-bar__btn pz-bar__btn--primary"
          disabled={!canEndTurn}
          onClick={() => setConfirmingEnd(true)}
        >
          {t("puzzle.session.end_turn")}
        </button>
      </div>

      {confirmingEnd && canEndTurn && (
        <ConfirmActionSheet
          text={{ key: "puzzle.session.end_confirm", params: {} }}
          onConfirm={endTurnNow}
          onCancel={() => setConfirmingEnd(false)}
        />
      )}

      {revealed === state && !ongoing && (
        <PuzzleResult
          outcome={outcome}
          reward={state.reward}
          test={state.test}
          onRestart={restart}
          onBack={back}
        />
      )}
    </div>
  );
}

/** Route `/puzzle/play` ; `?test=<id>` : partie de test d'un défi (admin). */
export default function PuzzlePlayRoute() {
  const [params] = useSearchParams();
  const test = Number(params.get("test"));
  const puzzleId = Number.isInteger(test) && test > 0 ? test : undefined;
  // key : un autre défi de test repart d'une connexion neuve
  return <PuzzlePlay key={puzzleId ?? "today"} puzzleId={puzzleId} />;
}
