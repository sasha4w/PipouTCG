import type { Lesson } from '../lesson.types';

/** Leçon 7 : Œuf et éclosion, évolution, Incubation Rapide, Transformer. */
export const drakon: Lesson = {
  id: 'drakon',
  board: {
    turnNumber: 3,
    p1: {
      hand: [
        'Œuf de la Genèse',
        'Incubation Rapide',
        'Jeune Tempestu',
        'Adulte Feros',
        'Prêtre Fouille',
        'Archer Crapouille',
      ],
      deck: ['Bébé Tempestu', 'Bébé Feros', 'Gardien Ratouile'],
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
      key: 'recycle',
      expect: { type: 'recycle', card: 'Prêtre Fouille' },
    },
    {
      kind: 'player',
      key: 'egg',
      expect: { type: 'summon', card: 'Œuf de la Genèse', zone: 0, pay: [] },
    },
    { kind: 'info', key: 'eggInfo' },
    {
      kind: 'player',
      key: 'incubation',
      expect: {
        type: 'play_support',
        card: 'Incubation Rapide',
        target: 'Œuf de la Genèse',
        targetSide: 'me',
      },
    },
    {
      kind: 'player',
      key: 'hatch',
      expect: { type: 'pick_cards', cards: ['Bébé Tempestu'] },
    },
    { kind: 'info', key: 'stages' },
    {
      kind: 'player',
      key: 'noShortcut',
      refused: true,
      expect: {
        type: 'summon',
        card: 'Adulte Feros',
        zone: 1,
        pay: ['Archer Crapouille'],
      },
    },
    {
      kind: 'player',
      key: 'evolve',
      expect: {
        type: 'evolve',
        card: 'Jeune Tempestu',
        target: 'Bébé Tempestu',
        pay: ['Archer Crapouille'],
      },
    },
    { kind: 'info', key: 'evolveDone' },
    {
      kind: 'player',
      key: 'transform',
      expect: { type: 'transform', card: 'Adulte Feros' },
    },
    {
      kind: 'player',
      key: 'transformPick',
      expect: { type: 'pick_cards', cards: ['Bébé Feros'] },
    },
    { kind: 'info', key: 'done' },
  ],
};
