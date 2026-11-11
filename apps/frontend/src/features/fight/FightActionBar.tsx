import type { TutorialHint } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import "./FightActionBar.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";
import { mainSlot } from "./mainSlot";

interface Props {
  phase: Phase | undefined;
  isMyTurn: boolean;
  selectedCard: HandCard | null;
  attackerSelected: boolean;
  /** Transformation déjà utilisée ce tour. */
  transformUsed: boolean;
  /** Raison pour laquelle l'Éphémère sélectionné ne peut pas être joué. */
  playBlockedReason?: string;
  onRecycle: () => void;
  onMain: () => void;
  /** Tutoriel : bouton à mettre en avant. */
  coach?: TutorialHint;
}

/** Deux emplacements fixes : Recycler à gauche, action principale à droite. */
export default function FightActionBar({
  phase,
  isMyTurn,
  selectedCard,
  attackerSelected,
  transformUsed,
  playBlockedReason,
  onRecycle,
  onMain,
  coach,
}: Props) {
  const { t } = useTranslation();

  // Phase de contrôle : Recycler devient Défausser, toujours proposé
  const discarding = phase === "end";
  const canRecycle =
    isMyTurn && selectedCard !== null && (phase === "main" || discarding);
  const slot = mainSlot({
    phase,
    isMyTurn,
    card: selectedCard,
    attackerSelected,
    transformUsed,
    playBlockedReason,
  });

  return (
    <div className="fab-bar">
      <div className="fab-btns">
        <button
          type="button"
          className={`fab-btn fab-btn--recycle${coach?.button === "recycle" ? " coach-hl" : ""}`}
          disabled={!canRecycle}
          title={t("fight.bar.recycleTitle")}
          onClick={onRecycle}
        >
          {t(discarding ? "fight.bar.discardAction" : "fight.bar.recycle")}
        </button>
        <button
          type="button"
          className="fab-btn fab-btn--main"
          disabled={!slot.enabled}
          title={
            slot.labelKey === "fight.transform" && transformUsed
              ? t("fight.transformOncePerTurn")
              : slot.labelKey === "fight.transform"
                ? t("fight.transformTitle")
                : undefined
          }
          onClick={onMain}
        >
          {t(slot.labelKey)}
        </button>
      </div>
    </div>
  );
}
