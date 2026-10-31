import type { AdventureArchetype } from "../game/adventure";
import type { GameAction } from "../game/action";

export const AI_VERDICTS = [
  "good",
  "better_action",
  "tactical_error",
  "missing_candidate",
  "uncertain",
] as const;
export type AiVerdict = (typeof AI_VERDICTS)[number];

export const AI_PROBLEM_CATEGORIES = [
  "candidate_generation",
  "heuristic_evaluation",
  "lookahead",
  "combat_calculation",
  "threat_priority",
  "card_synergy",
  "opportunity_cost",
  "other",
] as const;
export type AiProblemCategory = (typeof AI_PROBLEM_CATEGORIES)[number];

export const AI_OUTCOMES = ["win", "loss", "draw"] as const;
export type AiOutcome = (typeof AI_OUTCOMES)[number];

/** Comment l'IA a choisi son coup. */
export type AiDecisionSource = "greedy" | "plan" | "mistake" | "mulligan" | "fallback";

/** Un combat d'aventure journalisé (revue admin). */
export interface AiReviewGame {
  gameId: string;
  createdAt: string;
  archetype: AdventureArchetype;
  level: number;
  decisions: number;
  annotated: number;
  /** Décisions dont le regret dépasse le seuil « suspect ». */
  suspects: number;
}

export interface AiReviewDecisionSummary {
  id: string;
  turn: number;
  phase: string;
  source: AiDecisionSource;
  /** Coup choisi, avec des noms de carte. */
  chosenText: string;
  /** Écart heuristique : indicateur approximatif, pas une erreur avérée. */
  regret: number;
  annotated: boolean;
}

export interface AiReviewCandidate {
  index: number;
  action: GameAction;
  text: string;
  score: number;
  chosen: boolean;
}

export interface AiReviewAnnotation {
  id: number;
  decisionId: string;
  verdict: AiVerdict;
  preferred: GameAction | null;
  category: AiProblemCategory | null;
  comment: string | null;
  outcome: AiOutcome | null;
  createdAt: string;
}

export interface AiReviewDecision extends AiReviewDecisionSummary {
  gameId: string;
  seat: "p1" | "p2";
  archetype: AdventureArchetype;
  level: number;
  /** Score de l'état avant de jouer (comparé à `end_phase` par le glouton). */
  baseline: number | null;
  candidates: AiReviewCandidate[];
  simulationCrashes: { text: string; message: string }[];
  annotations: AiReviewAnnotation[];
}

export interface AiReviewAnnotationRequest {
  verdict: AiVerdict;
  /** Index du candidat préféré (voir `AiReviewCandidate.index`). */
  preferredIndex?: number;
  category?: AiProblemCategory;
  comment?: string;
  outcome?: AiOutcome;
}
