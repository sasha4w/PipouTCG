import type { TutorialLessonId } from "../game/tutorial";

export interface TutorialLessonView {
  id: TutorialLessonId;
  completed: boolean;
}

export interface TutorialOverview {
  lessons: TutorialLessonView[];
  reward: { gold: number; xp: number };
}

/** Fin d'une leçon, jointe à `fight:game_over`. */
export interface TutorialResultPayload {
  lessonId: TutorialLessonId;
  /** false : leçon abandonnée avant la fin. */
  completed: boolean;
  /** true : première fois, la récompense vient d'être versée. */
  firstCompletion: boolean;
  gold: number;
  xp: number;
}
