import { canTransform } from "@pipou/shared";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";

export interface MainSlot {
  labelKey: string;
  enabled: boolean;
  hintKey?: string;
}

export interface MainSlotInput {
  phase: Phase | undefined;
  isMyTurn: boolean;
  card: HandCard | null;
  attackerSelected: boolean;
  transformUsed: boolean;
  /** La carte sélectionnée peut évoluer sur un monstre allié. */
  canEvolve?: boolean;
  /** Raison pour laquelle l'Éphémère sélectionné ne peut pas être joué. */
  playBlockedReason?: string;
}

const IDLE: MainSlot = { labelKey: "fight.bar.action", enabled: false };

/** Contenu de l'emplacement principal : toujours un seul bouton, jamais déplacé. */
export function mainSlot({
  phase,
  isMyTurn,
  card,
  attackerSelected,
  transformUsed,
  canEvolve = false,
  playBlockedReason,
}: MainSlotInput): MainSlot {
  if (!isMyTurn) return IDLE;
  if (phase === "battle") {
    return attackerSelected
      ? { labelKey: "fight.bar.directAttack", enabled: true }
      : IDLE;
  }
  if (phase !== "main" || card === null) return IDLE;

  if (card.type === "monster") {
    const evolveHint = canEvolve ? "fight.evolveHint" : undefined;
    return canTransform({ stage: card.stage ?? null, lineage: card.lineage })
      ? {
          labelKey: "fight.transform",
          enabled: !transformUsed,
          hintKey: evolveHint,
        }
      : { ...IDLE, hintKey: evolveHint ?? "fight.bar.summonHint" };
  }
  switch (card.supportType) {
    case "EPHEMERAL":
      return {
        labelKey: "fight.bar.play",
        enabled: playBlockedReason === undefined,
      };
    case "TERRAIN":
      return {
        labelKey: "fight.bar.play",
        enabled: false,
        hintKey: "fight.bar.terrainHint",
      };
    case "EQUIPMENT":
      return {
        labelKey: "fight.bar.play",
        enabled: false,
        hintKey: "fight.bar.equipHint",
      };
    default:
      return IDLE;
  }
}
