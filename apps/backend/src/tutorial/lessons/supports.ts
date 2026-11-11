import type { Lesson } from '../lesson.types';

/** Leçon 4 : Éphémère ciblé, Équipement et emplacements, Terrain, Charge. */
export const supports: Lesson = {
  id: 'supports',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        'Frappe Préventive',
        'Processeur de Calcul .bin',
        'Canon à Particules .vxd',
        'Tactique Gang Gang',
        'Alerte générale',
      ],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
      monsters: ['Noyau Beta', 'Général Chatouille'],
    },
    p2: {
      hand: ['Gardien Ratouile'],
      deck: ['Prêtre Fouille', 'Gardien Ratouile'],
      monsters: ['Archer Crapouille'],
    },
  },
  steps: [
    { kind: 'info', key: 'intro' },
    {
      kind: 'player',
      key: 'ephemeral',
      expect: {
        type: 'play_support',
        card: 'Frappe Préventive',
        target: 'Archer Crapouille',
      },
    },
    { kind: 'info', key: 'ephemeralDone' },
    {
      kind: 'player',
      key: 'equipment',
      expect: {
        type: 'play_support',
        card: 'Processeur de Calcul .bin',
        target: 'Noyau Beta',
        targetSide: 'me',
      },
    },
    {
      kind: 'player',
      key: 'slot',
      expect: {
        type: 'play_support',
        card: 'Canon à Particules .vxd',
        target: 'Noyau Beta',
        targetSide: 'me',
        replace: 'Processeur de Calcul .bin',
      },
    },
    {
      kind: 'player',
      key: 'terrain',
      expect: { type: 'play_support', card: 'Tactique Gang Gang', zone: 0 },
    },
    { kind: 'info', key: 'terrainDone' },
    {
      kind: 'player',
      key: 'charge',
      expect: { type: 'play_support', card: 'Alerte générale', zone: 1 },
    },
    { kind: 'info', key: 'chargeDone' },
  ],
};
