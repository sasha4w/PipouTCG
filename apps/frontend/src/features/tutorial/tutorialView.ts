import {
  TUTORIAL_LESSONS,
  isTutorialLessonId,
  type MatchFoundPayload,
  type TutorialLessonId,
} from "@pipou/shared";

/** Chemin de l'écran d'une leçon. */
export const lessonPath = (id: TutorialLessonId): string => `/tutorial/${id}`;

/** Leçon suivante dans l'ordre d'apprentissage, ou null après la dernière. */
export function nextLesson(id: TutorialLessonId): TutorialLessonId | null {
  const i = TUTORIAL_LESSONS.indexOf(id);
  return TUTORIAL_LESSONS[i + 1] ?? null;
}

/** Identifiant de leçon d'une URL, ou null s'il est inconnu. */
export function parseLessonId(
  raw: string | undefined,
): TutorialLessonId | null {
  return isTutorialLessonId(raw) ? raw : null;
}

/**
 * Partie retrouvée à la connexion : null si c'est cette leçon (on la reprend
 * sur place), sinon l'écran où elle se joue.
 */
export function lessonResumeTarget(
  resumed: MatchFoundPayload,
  lessonId: TutorialLessonId,
): string | null {
  if (resumed.tutorialLessonId === lessonId) return null;
  if (resumed.tutorialLessonId !== undefined)
    return lessonPath(resumed.tutorialLessonId);
  if (resumed.adventureOpponentId !== undefined)
    return `/adventure/fight/${resumed.adventureOpponentId}`;
  return "/fight";
}
