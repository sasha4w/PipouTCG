import { useTranslation } from "react-i18next";
import type { TutorialHint } from "@pipou/shared";
import { IconHourglass } from "../../components/Icons";
import { useHideAppChrome } from "./useHideAppChrome";
import FightBoard from "./FightBoard";
import CardPickModal from "./CardPickModal";
import MulliganPanel from "./MulliganPanel";
import type { GameState } from "./fight.types";
import type { useBoardControls } from "./useBoardControls";

interface FightArenaProps {
  gameState: GameState;
  timeLeft: number;
  controls: ReturnType<typeof useBoardControls>;
  onSurrender: () => void;
  /** Tutoriel : ce que la bulle de la leçon désigne. */
  coach?: TutorialHint;
}

/** Plateau d'une partie en cours : mulligan, plateau, choix de cartes. */
export default function FightArena({
  gameState,
  timeLeft,
  controls,
  onSurrender,
  coach,
}: FightArenaProps) {
  const { t } = useTranslation();
  useHideAppChrome();
  if (gameState.phase === "mulligan") {
    return (
      <MulliganPanel
        hand={gameState.me.hand}
        decided={gameState.me.mulliganDone}
        opponentDecided={gameState.opponent.mulliganDone}
        opponentName={gameState.opponent.username}
        onDecide={controls.decideMulligan}
      />
    );
  }

  return (
    <>
      {gameState.opponentChoosing && (
        <div className="fp-waiting-choice">
          <IconHourglass size={14} />{" "}
          {t("fight.opponentChoosing", {
            name: gameState.opponent.username,
          })}
        </div>
      )}
      <FightBoard
        gs={gameState}
        {...controls.board}
        timeLeft={timeLeft}
        onSurrender={onSurrender}
        coach={coach}
      />

      {gameState.pendingChoice && (
        <CardPickModal
          choice={gameState.pendingChoice}
          onConfirm={controls.pickCards}
        />
      )}
    </>
  );
}
