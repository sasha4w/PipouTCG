import type { LessonStep } from '../lesson.types';

/** Phase principale → phase de combat. */
export const toBattle = (): LessonStep => ({
  kind: 'player',
  key: 'common.toBattle',
  expect: { type: 'end_phase' },
});

/** Phase de combat → phase de contrôle (leçon dédiée seulement). */
export const toControl = (): LessonStep => ({
  kind: 'player',
  key: 'common.toControl',
  expect: { type: 'end_phase' },
});

/** « Finir le tour » du menu de phase : d'un clic, quelle que soit la phase. */
export const endTurn = (): LessonStep => ({
  kind: 'player',
  key: 'common.endTurn',
  expect: { type: 'end_turn' },
});

/** L'adversaire finit son tour d'un coup : la main revient au joueur. */
export const opponentEndsTurn = (): LessonStep => ({
  kind: 'opponent',
  key: 'common.opponentEnd',
  do: { type: 'end_turn' },
});
