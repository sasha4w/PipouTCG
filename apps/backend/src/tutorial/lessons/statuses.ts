import type { Lesson } from '../lesson.types';
import { opponentEndsTurn, toBattle } from './common';

/** Leçon 9 : entraves subies, statuts de combat, immunités. */
export const statuses: Lesson = {
  id: 'statuses',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        'Commandant Quenouille',
        'Protocole de Gel .frz',
        'Prêtre Fouille',
        'Archer Crapouille',
      ],
      deck: ['Gardien Ratouile', 'Prêtre Fouille', 'Archer Crapouille'],
      monsters: ['Chevalier Touille', 'Gardien Ratouile'],
    },
    p2: {
      hand: [
        'Protocole de Gel .frz',
        'Verrou de Position .lock',
        'Rootkit de Transmission',
      ],
      deck: ['Prêtre Fouille', 'Gardien Ratouile', 'Archer Crapouille'],
      monsters: ['Adulte Teros', 'Archer Crapouille'],
    },
    turn: 'p2',
  },
  steps: [
    { kind: 'info', key: 'intro' },
    {
      kind: 'opponent',
      key: 'freeze',
      do: {
        type: 'play_support',
        card: 'Protocole de Gel .frz',
        target: 'Chevalier Touille',
      },
    },
    {
      kind: 'opponent',
      key: 'lock',
      do: {
        type: 'play_support',
        card: 'Verrou de Position .lock',
        target: 'Gardien Ratouile',
      },
    },
    {
      kind: 'opponent',
      key: 'forced',
      do: {
        type: 'play_support',
        card: 'Rootkit de Transmission',
        target: 'Chevalier Touille',
      },
    },
    opponentEndsTurn(),
    { kind: 'info', key: 'restraints' },
    {
      kind: 'info',
      key: 'lockedMode',
      engineRefuses: {
        type: 'change_mode',
        monster: 'Gardien Ratouile',
        mode: 'attack',
      },
    },
    {
      kind: 'info',
      key: 'forcedMode',
      engineRefuses: {
        type: 'change_mode',
        monster: 'Chevalier Touille',
        mode: 'guard',
      },
    },
    {
      kind: 'player',
      key: 'summonTurn',
      expect: {
        type: 'summon',
        card: 'Commandant Quenouille',
        zone: 2,
        pay: ['Prêtre Fouille', 'Archer Crapouille'],
      },
    },
    { kind: 'info', key: 'combatStatuses' },
    {
      kind: 'info',
      key: 'immune',
      engineRefuses: {
        type: 'play_support',
        card: 'Protocole de Gel .frz',
        target: 'Adulte Teros',
      },
    },
    {
      kind: 'player',
      key: 'notImmune',
      expect: {
        type: 'play_support',
        card: 'Protocole de Gel .frz',
        target: 'Archer Crapouille',
      },
    },
    { kind: 'info', key: 'immunities' },
    toBattle(),
    {
      kind: 'info',
      key: 'frozenAttack',
      engineRefuses: {
        type: 'attack',
        attacker: 'Chevalier Touille',
        target: 'Archer Crapouille',
      },
    },
    {
      kind: 'info',
      key: 'summonedAttack',
      engineRefuses: {
        type: 'attack',
        attacker: 'Commandant Quenouille',
        target: 'Archer Crapouille',
      },
    },
    { kind: 'info', key: 'done' },
  ],
};
