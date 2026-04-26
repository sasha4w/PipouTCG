import "./FightActionBar.css";
import type { Phase, MonsterOnBoard } from "./fight.types";
import { END_PHASE_LABEL, FREE_SUMMON_CARD_ID } from "./fight.types";
import type { HandCard } from "./FightHand";

interface Props {
  phase: Phase | undefined;
  isMyTurn: boolean;
  selectedCard: number | null;
  selectedZone: number | null;
  hand: HandCard[];
  monsterZones: (MonsterOnBoard | null)[];
  freeSummonAvailable?: boolean;
  onSummon: () => void;
  onOpenSummonModal: () => void; // ouvre la modal de coût
  onPlaySupport: (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => void;
  onEndPhase: () => void;
  onSurrender: () => void;
  onRecycleFromHand: (handIndex: number) => void;
}

export default function FightActionBar({
  phase,
  isMyTurn,
  selectedCard,
  selectedZone,
  hand,
  monsterZones,
  freeSummonAvailable = false,
  onSummon,
  onOpenSummonModal,
  onPlaySupport,
  onEndPhase,
  onSurrender,
  onRecycleFromHand,
}: Props) {
  if (!isMyTurn) return null;

  const card = selectedCard !== null ? hand[selectedCard] : null;
  const overhandLimit = phase === "end" && hand.length > 7;

  const isFreeCard = freeSummonAvailable && card?.id === FREE_SUMMON_CARD_ID;

  /**
   * Summon button logic:
   * - Free card (Chevalier Touille + freeSummonAvailable) → invoke directly, no modal
   * - Cost = 0 → invoke directly, no modal
   * - Otherwise → open cost modal
   */
  const handleSummonClick = () => {
    if (!card) return;
    if (isFreeCard || (card.cost ?? 0) === 0) {
      onSummon();
    } else {
      onOpenSummonModal();
    }
  };

  return (
    <div className="fab-bar">
      {phase === "main" && card !== null && (
        <>
          {card.type === "monster" && selectedZone !== null && (
            <button onClick={handleSummonClick} className="fab-btn">
              {isFreeCard ? "⚡ Invoquer (gratuit)" : "⬆️ Invoquer"}
            </button>
          )}

          {card.type === "support" &&
            (!card.supportType || card.supportType === "EPHEMERAL") && (
              <button
                onClick={() => onPlaySupport(selectedCard!)}
                className="fab-btn"
              >
                ✨ Jouer
              </button>
            )}

          {card.type === "support" &&
            card.supportType === "TERRAIN" &&
            selectedZone !== null && (
              <button
                onClick={() => onPlaySupport(selectedCard!, selectedZone)}
                className="fab-btn"
              >
                🌍 Poser le Terrain
              </button>
            )}

          {card.type === "support" &&
            card.supportType === "EQUIPMENT" &&
            selectedZone !== null &&
            monsterZones[selectedZone] && (
              <button
                onClick={() =>
                  onPlaySupport(
                    selectedCard!,
                    undefined,
                    monsterZones[selectedZone!]!.instanceId,
                  )
                }
                className="fab-btn"
              >
                🔧 Équiper
              </button>
            )}

          <button
            onClick={() => onRecycleFromHand(selectedCard!)}
            className="fab-btn fab-btn--recycle"
          >
            ♻️ Recycler (+1⚡)
          </button>
        </>
      )}

      {overhandLimit && (
        <span className="fab-discard-warning">
          ⚠️ Défausse {hand.length - 7} carte{hand.length - 7 > 1 ? "s" : ""}{" "}
          (clique sur la carte)
        </span>
      )}

      <button
        onClick={onEndPhase}
        disabled={overhandLimit}
        className={`fab-btn-phase${overhandLimit ? " fab-btn-phase--disabled" : ""}`}
      >
        {END_PHASE_LABEL[phase ?? "main"] ?? "Continuer →"}
      </button>

      <button onClick={onSurrender} className="fab-btn-surrender">
        🏳️ Abandonner
      </button>
    </div>
  );
}
