import type { DecisionSink } from '../fights/ai/decision-log';

/** Jeton d'injection : FightsService ne dépend pas du module de revue. */
export const AI_DECISION_RECORDER = Symbol('AI_DECISION_RECORDER');

export interface DecisionRecorder {
  /** Sink qui journalise les décisions de l'IA ; null si le joueur n'est pas admin. */
  sinkFor(userId: number, isAdmin: boolean): DecisionSink | null;
}
