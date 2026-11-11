import type { Lesson } from '../lesson.types';
import { endTurn, opponentEndsTurn, toBattle, toControl } from './common';

/** Leçon 5 : support après le combat, limite de 7 cartes, défausse. */
export const control: Lesson = {
  id: 'control',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        "Soin d'urgence",
        'Lieutenant Bidouille',
        'Gardien Ratouile',
        'Prêtre Fouille',
        'Archer Crapouille',
        'Caporal Gazouille',
        'Guerrier Bafouille',
        'Recrue Andouille',
        'Éclaireur Nouille',
      ],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
      monsters: [{ card: 'Chevalier Touille', currentHp: 500 }],
    },
    p2: {
      hand: ['Gardien Ratouile'],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
      monsters: ['Sentinelle Gargouille'],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    toBattle(),
    {
      kind: 'player',
      key: 'battle',
      expect: {
        type: 'attack',
        attacker: 'Chevalier Touille',
        target: 'Sentinelle Gargouille',
      },
    },
    toControl(),
    { kind: 'info', key: 'controlPhase' },
    {
      kind: 'player',
      key: 'support',
      expect: {
        type: 'play_support',
        card: "Soin d'urgence",
        target: 'Chevalier Touille',
        targetSide: 'me',
      },
    },
    {
      kind: 'info',
      key: 'noSummon',
      engineRefuses: {
        type: 'summon',
        card: 'Lieutenant Bidouille',
        zone: 1,
        pay: ['Gardien Ratouile'],
      },
    },
    { kind: 'info', key: 'handLimit' },
    {
      kind: 'player',
      key: 'discard',
      expect: { type: 'discard', card: 'Gardien Ratouile' },
    },
    endTurn(),
    opponentEndsTurn(),
    { kind: 'info', key: 'done' },
  ],
};
