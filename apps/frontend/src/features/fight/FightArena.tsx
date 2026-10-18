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
}

/** Plateau d'une partie en cours : mulligan, plateau, choix de cartes. */
export default function FightArena({
  gameState,
  timeLeft,
  controls,
  onSurrender,
}: FightArenaProps) {
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
          ⏳ {gameState.opponent.username} fait un choix…
        </div>
      )}
      <FightBoard
        gs={gameState}
        {...controls.board}
        timeLeft={timeLeft}
        onSurrender={onSurrender}
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
