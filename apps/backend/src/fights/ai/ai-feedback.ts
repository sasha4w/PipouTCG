import { AI_OUTCOMES, AI_PROBLEM_CATEGORIES, AI_VERDICTS } from '@pipou/shared';
import type {
  AiOutcome,
  AiProblemCategory,
  AiVerdict,
  GameAction,
} from '@pipou/shared';

export type Verdict = AiVerdict;
export type ProblemCategory = AiProblemCategory;
export type GameOutcome = AiOutcome;

/**
 * Avis humain sur une décision. Un exemple à analyser, pas une vérité :
 * `uncertain` dit qu'on n'est pas sûr.
 */
export interface Annotation {
  decisionId: string;
  verdict: Verdict;
  /** Coup qu'aurait dû jouer l'IA, quand on le connaît. */
  preferred?: GameAction;
  category?: ProblemCategory;
  comment?: string;
  /** Résultat de la partie pour l'IA, quand il est connu. */
  outcome?: GameOutcome;
  createdAt: string;
}

/** Valide une annotation lue d'un fichier ; lève avec la raison sinon. */
export function parseAnnotation(raw: unknown): Annotation {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('annotation : objet attendu');
  const a = raw as Record<string, unknown>;
  if (typeof a.decisionId !== 'string' || !a.decisionId)
    throw new Error('annotation : decisionId manquant');
  if (!AI_VERDICTS.includes(a.verdict as Verdict))
    throw new Error(`annotation : verdict inconnu (${String(a.verdict)})`);
  if (
    a.category !== undefined &&
    !AI_PROBLEM_CATEGORIES.includes(a.category as ProblemCategory)
  )
    throw new Error(
      `annotation : catégorie inconnue (${JSON.stringify(a.category)})`,
    );
  if (
    a.outcome !== undefined &&
    !AI_OUTCOMES.includes(a.outcome as GameOutcome)
  )
    throw new Error(
      `annotation : résultat inconnu (${JSON.stringify(a.outcome)})`,
    );
  if (a.comment !== undefined && typeof a.comment !== 'string')
    throw new Error('annotation : commentaire invalide');
  if (
    a.preferred !== undefined &&
    (typeof a.preferred !== 'object' ||
      a.preferred === null ||
      typeof (a.preferred as { type?: unknown }).type !== 'string')
  )
    throw new Error('annotation : action préférée invalide');
  if (a.verdict === 'better_action' && a.preferred === undefined)
    throw new Error('annotation : better_action demande une action préférée');
  return {
    decisionId: a.decisionId,
    verdict: a.verdict as Verdict,
    preferred: a.preferred as GameAction | undefined,
    category: a.category as ProblemCategory | undefined,
    comment: a.comment,
    outcome: a.outcome as GameOutcome | undefined,
    createdAt:
      typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
  };
}
