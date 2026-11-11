import type { Lesson } from '../lesson.types';
import { endTurn, opponentPasses, toBattle, toControl } from './common';

/** Leçon 2 : ATK contre ATK et riposte, double K.O., attaque directe, dernière Prime. */
export const combat: Lesson = {
  id: 'combat',
  board: {
    turnNumber: 3,
    p1: {
      primes: 3,
      hand: ['Prêtre Fouille', 'Gardien Ratouile'],
      deck: ['Archer Crapouille', 'Prêtre Fouille', 'Gardien Ratouile'],
      monsters: [
        'Chevalier Touille',
        'Lieutenant Bidouille',
        'Éclaireur Nouille',
      ].map((card, i) => ({ card, currentHp: i === 2 ? 300 : undefined })),
    },
    p2: {
      primes: 6,
      hand: ['Gardien Ratouile'],
      deck: ['Archer Crapouille', 'Prêtre Fouille', 'Gardien Ratouile'],
      monsters: [
        'Lieutenant Fripouille',
        { card: 'Archer Crapouille', currentHp: 100 },
      ],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    toBattle(),
    {
      kind: 'player',
      key: 'attackRiposte',
      expect: {
        type: 'attack',
        attacker: 'Chevalier Touille',
        target: 'Lieutenant Fripouille',
      },
    },
    { kind: 'info', key: 'riposte' },
    {
      kind: 'player',
      key: 'attackKill',
      expect: {
        type: 'attack',
        attacker: 'Lieutenant Bidouille',
        target: 'Lieutenant Fripouille',
      },
    },
    { kind: 'info', key: 'prime' },
    toControl(),
    endTurn(),
    {
      kind: 'opponent',
      key: 'opponentToBattle',
      do: { type: 'end_phase' },
    },
    {
      kind: 'opponent',
      key: 'doubleKo',
      do: {
        type: 'attack',
        attacker: 'Archer Crapouille',
        target: 'Éclaireur Nouille',
      },
    },
    { kind: 'info', key: 'doubleKoInfo' },
    ...opponentPasses().slice(1),
    { kind: 'info', key: 'emptyBoard' },
    toBattle(),
    {
      kind: 'player',
      key: 'direct',
      expect: { type: 'attack', attacker: 'Chevalier Touille' },
    },
  ],
};
