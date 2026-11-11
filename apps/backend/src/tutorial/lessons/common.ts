import type { LessonStep } from '../lesson.types';

/** Phase principale → phase de combat. */
export const toBattle = (): LessonStep => ({
  kind: 'player',
  key: 'common.toBattle',
  expect: { type: 'end_phase' },
});

/** Phase de combat → phase de contrôle. */
export const toControl = (): LessonStep => ({
  kind: 'player',
  key: 'common.toControl',
  expect: { type: 'end_phase' },
});

/** Phase de contrôle → tour de l'adversaire. */
export const endTurn = (): LessonStep => ({
  kind: 'player',
  key: 'common.endTurn',
  expect: { type: 'end_phase' },
});

/** Tour du joueur terminé depuis la phase principale : trois passages de phase. */
export const passTurn = (): LessonStep[] => [
  toBattle(),
  toControl(),
  endTurn(),
];

/** L'adversaire ne joue rien : il passe ses trois phases. */
export const opponentPasses = (): LessonStep[] =>
  (
    [
      'common.opponentMain',
      'common.opponentBattle',
      'common.opponentEnd',
    ] as const
  ).map((key): LessonStep => ({
    kind: 'opponent',
    key,
    do: { type: 'end_phase' },
  }));

/** L'adversaire passe sa phase principale et sa phase de combat, puis sa phase de contrôle. */
export const opponentEndsTurn = opponentPasses;
