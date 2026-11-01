import { HAND_LIMIT } from "@pipou/shared";
import type { Phase } from "./fight.types";

export type PhaseTarget = "battle" | "end" | "endTurn";

export interface PhaseOption {
  target: PhaseTarget;
  /** Nombre de `end_phase` à envoyer pour atteindre la cible. */
  steps: number;
  disabledReason?: "discard";
}

/** Phases restantes dans l'ordre du tour ; on ne revient jamais en arrière. */
const ORDER: Partial<Record<Phase, PhaseTarget[]>> = {
  main: ["battle", "end", "endTurn"],
  battle: ["end", "endTurn"],
  end: ["endTurn"],
};

/** Cibles possibles depuis `phase`, avec le blocage de la limite de main. */
export function phaseOptions(phase: Phase, handSize: number): PhaseOption[] {
  const targets = ORDER[phase] ?? [];
  return targets.map((target, i) => ({
    target,
    steps: i + 1,
    ...(target === "endTurn" &&
      handSize > HAND_LIMIT && { disabledReason: "discard" as const }),
  }));
}
