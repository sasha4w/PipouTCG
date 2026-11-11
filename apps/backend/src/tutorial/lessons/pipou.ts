import type { Lesson } from '../lesson.types';
import { endTurn, opponentPasses, toBattle, toControl } from './common';

/** Leçon 6 : vagues d'Énergie, invocation gratuite, Terrain, Relève, Provocation. */
export const pipou: Lesson = {
  id: 'pipou',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        "Clairon de l'Union",
        'Chevalier Touille',
        'Lieutenant Bidouille',
        'Capitaine Gribouille',
        'Tactique Gang Gang',
        'Général Chatouille',
        'Prêtre Fouille',
      ],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
    },
    p2: {
      hand: ['Gardien Ratouile'],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
      monsters: ['Archer Crapouille', 'Maraudeur Friponouille'],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    {
      kind: 'player',
      key: 'clairon',
      expect: { type: 'play_support', card: "Clairon de l'Union" },
    },
    {
      kind: 'player',
      key: 'gribouille',
      expect: {
        type: 'summon',
        card: 'Capitaine Gribouille',
        zone: 2,
        pay: [],
      },
    },
    { kind: 'info', key: 'free' },
    {
      kind: 'player',
      key: 'chevalier',
      expect: { type: 'summon', card: 'Chevalier Touille', zone: 0, pay: [] },
    },
    {
      kind: 'player',
      key: 'bidouille',
      expect: {
        type: 'summon',
        card: 'Lieutenant Bidouille',
        zone: 1,
        pay: ['Prêtre Fouille'],
      },
    },
    { kind: 'info', key: 'taunt' },
    {
      kind: 'player',
      key: 'gangGang',
      expect: { type: 'play_support', card: 'Tactique Gang Gang', zone: 0 },
    },
    { kind: 'info', key: 'gangGangDone' },
    {
      kind: 'player',
      key: 'releve',
      expect: {
        type: 'summon',
        card: 'Général Chatouille',
        zone: 1,
        pay: [],
        releve: ['Lieutenant Bidouille', 'Chevalier Touille'],
      },
    },
    { kind: 'info', key: 'releveDone' },
    toBattle(),
    toControl(),
    endTurn(),
    { kind: 'opponent', key: 'opponentToBattle', do: { type: 'end_phase' } },
    {
      kind: 'opponent',
      key: 'opponentTaunt',
      do: {
        type: 'attack',
        attacker: 'Archer Crapouille',
        target: 'Capitaine Gribouille',
      },
    },
    ...opponentPasses().slice(1),
    { kind: 'info', key: 'done' },
  ],
};
