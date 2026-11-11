import type { Lesson, LessonStep } from '../lesson.types';
import {
  endTurn,
  opponentPasses,
  passTurn,
  toBattle,
  toControl,
} from './common';

/** Tour entier du joueur sans rien jouer : trois passages de phase. */
const idleTurn = (): LessonStep[] => passTurn();

/** Leçon 3 : Garde, pas de Prime, 2 tours max, contre-offensive, Perçant. */
export const guard: Lesson = {
  id: 'guard',
  board: {
    turnNumber: 3,
    p1: {
      primes: 6,
      hand: ['Prêtre Fouille'],
      deck: [
        'Gardien Ratouile',
        'Prêtre Fouille',
        'Gardien Ratouile',
        'Prêtre Fouille',
      ],
      monsters: [
        { card: 'Lieutenant Bidouille', currentHp: 300 },
        { card: 'Chevalier Touille', currentHp: 400 },
        'Prêtre Fouille',
      ],
    },
    p2: {
      primes: 6,
      hand: ['Gardien Ratouile'],
      deck: [
        'Gardien Ratouile',
        'Prêtre Fouille',
        'Gardien Ratouile',
        'Prêtre Fouille',
      ],
      monsters: ['Archer Crapouille', 'Maraudeur Friponouille'],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    {
      kind: 'player',
      key: 'guardBidouille',
      expect: {
        type: 'change_mode',
        monster: 'Lieutenant Bidouille',
        mode: 'guard',
      },
    },
    {
      kind: 'player',
      key: 'guardChevalier',
      expect: {
        type: 'change_mode',
        monster: 'Chevalier Touille',
        mode: 'guard',
      },
    },
    {
      kind: 'player',
      key: 'guardPretre',
      expect: {
        type: 'change_mode',
        monster: 'Prêtre Fouille',
        mode: 'guard',
      },
    },
    toBattle(),
    toControl(),
    endTurn(),
    { kind: 'opponent', key: 'opponentToBattle', do: { type: 'end_phase' } },
    {
      kind: 'opponent',
      key: 'noPrime',
      do: {
        type: 'attack',
        attacker: 'Archer Crapouille',
        target: 'Lieutenant Bidouille',
      },
    },
    { kind: 'info', key: 'noPrimeInfo' },
    {
      kind: 'opponent',
      key: 'piercing',
      do: {
        type: 'attack',
        attacker: 'Maraudeur Friponouille',
        target: 'Chevalier Touille',
      },
    },
    { kind: 'info', key: 'piercingInfo' },
    ...opponentPasses().slice(1),
    { kind: 'info', key: 'turnHeld' },
    ...idleTurn(),
    ...opponentPasses(),
    { kind: 'info', key: 'counter' },
    toBattle(),
    {
      kind: 'player',
      key: 'counterAttack',
      expect: {
        type: 'attack',
        attacker: 'Prêtre Fouille',
        target: 'Archer Crapouille',
      },
    },
    { kind: 'info', key: 'done' },
  ],
};
