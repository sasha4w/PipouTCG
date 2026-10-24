import { HAND_LIMIT, canTransform } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import { IconEvolve, IconTransform } from "../../components/Icons";
import "./FightActionBar.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";

interface Props {
  phase: Phase | undefined;
  isMyTurn: boolean;
  selectedCard: number | null;
  selectedZone: number | null;
  hand: HandCard[];
  freeSummonInstanceIds: string[];
  onSummon: () => void;
  onOpenSummonModal: () => void; // ouvre la modal de coût
  onPlaySupport: (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => void;
  onEndPhase: () => void;
  /** Absent : pas de bouton d'abandon. */
  onSurrender?: () => void;
  onRecycleFromHand: (handIndex: number) => void;
  onTransformFromHand: (handIndex: number) => void;
  /** Transformation déjà utilisée ce tour. */
  transformUsed?: boolean;
  /** Raison pour laquelle l'Éphémère sélectionné ne peut pas être joué. */
  playBlockedReason?: string;
  /** La carte sélectionnée (Jeune/Adulte) peut évoluer sur un monstre allié. */
  canEvolve?: boolean;
}

export default function FightActionBar({
  phase,
  isMyTurn,
  selectedCard,
  selectedZone,
  hand,
  freeSummonInstanceIds,
  onSummon,
  onOpenSummonModal,
  onPlaySupport,
  onEndPhase,
  onSurrender,
  onRecycleFromHand,
  onTransformFromHand,
  transformUsed = false,
  playBlockedReason,
  canEvolve = false,
}: Props) {
  const { t } = useTranslation();
  if (!isMyTurn) return null;

  const card = selectedCard !== null ? hand[selectedCard] : null;
  const overhandLimit = phase === "end" && hand.length > HAND_LIMIT;

  const isFreeCard =
    card !== null && freeSummonInstanceIds.includes(card.instanceId);

  /**
   * Summon button logic:
   * - Free card (rendue gratuite par SET_FREE_SUMMON) → invoke directly, no modal
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
              {isFreeCard
                ? `⚡ ${t("fight.bar.summonFree")}`
                : `⬆️ ${t("fight.bar.summon")}`}
            </button>
          )}

          {card.type === "monster" && canEvolve && (
            <span className="fab-hint">
              <IconEvolve size={14} /> {t("fight.evolveHint")}
            </span>
          )}

          {/* Carte EPHEMERAL : le choix de cible éventuel est géré par le plateau */}
          {card.type === "support" && card.supportType === "EPHEMERAL" && (
            <button
              onClick={() => onPlaySupport(selectedCard!)}
              className="fab-btn"
              disabled={playBlockedReason !== undefined}
              title={playBlockedReason}
            >
              ✨ {t("fight.bar.play")}
              {playBlockedReason ? ` — ${playBlockedReason}` : ""}
            </button>
          )}

          {/* Rappel visuel pour TERRAIN et EQUIPMENT (action sur la zone) */}
          {card.type === "support" && card.supportType === "TERRAIN" && (
            <span className="fab-hint">🌍 {t("fight.bar.terrainHint")}</span>
          )}
          {card.type === "support" && card.supportType === "EQUIPMENT" && (
            <span className="fab-hint">🔧 {t("fight.bar.equipHint")}</span>
          )}

          {card.type === "monster" &&
            canTransform({
              stage: card.stage ?? null,
              lineage: card.lineage,
            }) && (
              <button
                onClick={() => onTransformFromHand(selectedCard!)}
                className="fab-btn"
                disabled={transformUsed}
                title={
                  transformUsed
                    ? t("fight.transformOncePerTurn")
                    : t("fight.transformTitle")
                }
              >
                <IconTransform size={14} /> {t("fight.transform")}
              </button>
            )}

          <button
            onClick={() => onRecycleFromHand(selectedCard!)}
            className="fab-btn fab-btn--recycle"
          >
            ♻️ {t("fight.bar.recycle")}
          </button>
        </>
      )}

      {overhandLimit && (
        <span className="fab-discard-warning">
          ⚠️ {t("fight.bar.discard", { count: hand.length - HAND_LIMIT })}
        </span>
      )}

      <button
        onClick={onEndPhase}
        disabled={overhandLimit}
        className={`fab-btn-phase${overhandLimit ? " fab-btn-phase--disabled" : ""}`}
      >
        {t(
          phase === "main" || phase === "battle" || phase === "end"
            ? `fight.endPhase.${phase}`
            : phase === undefined
              ? "fight.endPhase.main"
              : "fight.endPhase.other",
        )}
      </button>

      {onSurrender && (
        <button onClick={onSurrender} className="fab-btn-surrender">
          🏳️ {t("fight.bar.surrender")}
        </button>
      )}
    </div>
  );
}
