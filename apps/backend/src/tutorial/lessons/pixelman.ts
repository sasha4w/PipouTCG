import type { Lesson } from '../lesson.types';
import { endTurn, opponentEndsTurn } from './common';

/** Leçon 8 : Noyaux, équipement, Force Plasma (sans Prime), Zeta implanté et désinfection. */
export const pixelman: Lesson = {
  id: 'pixelman',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        'Canon à Particules .vxd',
        'Force Plasma',
        'Noyau Zeta',
        'Sentinelle .cfg',
        'Prêtre Fouille',
        'Archer Crapouille',
      ],
      deck: ['Gardien Ratouile', 'Prêtre Fouille', 'Archer Crapouille'],
      monsters: ['Noyau Delta'],
    },
    p2: {
      hand: ['Gardien Ratouile'],
      deck: ['Prêtre Fouille', 'Gardien Ratouile', 'Archer Crapouille'],
      monsters: [
        'Archer Crapouille',
        { card: 'Noyau Zeta', implantedBy: 'p1', turnCounter: 1 },
        'Adulte Feros',
      ],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    {
      kind: 'player',
      key: 'equipment',
      expect: {
        type: 'play_support',
        card: 'Canon à Particules .vxd',
        target: 'Noyau Delta',
        targetSide: 'me',
      },
    },
    {
      kind: 'player',
      key: 'plasma',
      expect: {
        type: 'play_support',
        card: 'Force Plasma',
        target: 'Archer Crapouille',
      },
    },
    { kind: 'info', key: 'noPrime' },
    { kind: 'info', key: 'zetaCountdown' },
    endTurn(),
    opponentEndsTurn(),
    { kind: 'info', key: 'zetaExplodes' },
    {
      kind: 'player',
      key: 'implant',
      expect: {
        type: 'summon',
        card: 'Noyau Zeta',
        zone: 0,
        pay: ['Sentinelle .cfg', 'Prêtre Fouille'],
        onOpponentSide: true,
      },
    },
    { kind: 'info', key: 'implantInfo' },
    endTurn(),
    { kind: 'opponent', key: 'opponentToBattle', do: { type: 'end_phase' } },
    {
      kind: 'opponent',
      key: 'disinfect',
      do: {
        type: 'attack',
        attacker: 'Adulte Feros',
        target: 'Noyau Zeta',
        targetSide: 'me',
      },
    },
    opponentEndsTurn(),
    { kind: 'info', key: 'done' },
  ],
};
