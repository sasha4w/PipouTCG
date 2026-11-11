import type { Lesson } from '../lesson.types';
import { endTurn, opponentEndsTurn } from './common';

/** Leçon 1 : pioche, Énergie, invocation, paiement par défausse, phases. */
export const firstTurn: Lesson = {
  id: 'first-turn',
  board: {
    turnNumber: 1,
    p1: {
      hand: [
        'Lieutenant Bidouille',
        'Guerrier Bafouille',
        'Caporal Gazouille',
        'Recrue Andouille',
        'Éclaireur Nouille',
        'Sentinelle Gargouille',
      ],
      deck: ['Archer Crapouille', 'Prêtre Fouille', 'Gardien Ratouile'],
    },
    p2: {
      hand: ['Sentinelle Gargouille', 'Lieutenant Fripouille'],
      deck: ['Archer Crapouille', 'Prêtre Fouille', 'Gardien Ratouile'],
    },
  },
  steps: [
    { kind: 'info', key: 'goal' },
    { kind: 'info', key: 'hand' },
    {
      kind: 'player',
      key: 'recycle',
      expect: { type: 'recycle', card: 'Recrue Andouille' },
    },
    {
      kind: 'player',
      key: 'summonEnergy',
      expect: {
        type: 'summon',
        card: 'Lieutenant Bidouille',
        zone: 1,
        pay: [],
      },
    },
    {
      kind: 'player',
      key: 'summonPay',
      expect: {
        type: 'summon',
        card: 'Guerrier Bafouille',
        zone: 0,
        pay: ['Caporal Gazouille'],
      },
    },
    { kind: 'info', key: 'board' },
    endTurn(),
    {
      kind: 'opponent',
      key: 'opponentRecycle',
      do: { type: 'recycle', card: 'Lieutenant Fripouille' },
    },
    {
      kind: 'opponent',
      key: 'opponentSummon',
      do: { type: 'summon', card: 'Sentinelle Gargouille', zone: 1, pay: [] },
    },
    opponentEndsTurn(),
    { kind: 'info', key: 'nextTurn' },
    { kind: 'info', key: 'done' },
  ],
};
