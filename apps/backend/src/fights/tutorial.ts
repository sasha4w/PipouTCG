import type { TutorialLessonId, TutorialResultPayload } from '@pipou/shared';
import type { GameState } from './interfaces/game-state.interface';
import type { LessonRunner } from '../tutorial/lesson-runner';

/** Délai entre deux coups de l'adversaire scripté d'une leçon. */
export const TUTORIAL_ACTION_DELAY_MS = 1500;

/** Leçon prête à jouer : plateau posé et déroulé des étapes. */
export interface TutorialStart {
  lessonId: TutorialLessonId;
  /** Le joueur est `player1` ; l'adversaire scripté porte l'identifiant `matchId`. */
  game: GameState;
  runner: LessonRunner;
}

/**
 * Ce que le tutoriel fournit à FightsService (jeton `TUTORIAL_HOOKS`) :
 * FightsService ne dépend pas du module Tutoriel, ce qui évite l'import circulaire.
 */
export interface TutorialHooks {
  prepare(
    userId: number,
    username: string,
    lessonId: TutorialLessonId,
  ): Promise<TutorialStart>;
  recordResult(
    userId: number,
    lessonId: TutorialLessonId,
    completed: boolean,
  ): Promise<TutorialResultPayload>;
}

export const TUTORIAL_HOOKS = Symbol('TUTORIAL_HOOKS');
