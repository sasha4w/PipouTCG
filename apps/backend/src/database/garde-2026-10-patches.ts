import type { CardEffect } from '@pipou/shared';
import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalanceFields, BalancePatch } from './balance-2026-10-patches';

/**
 * Patch « Garde, Relève et Drakons des Origines », cartes existantes
 * (design 2026-10-23, sections 2 à 4). Format et garde du rééquilibrage 2026-10.
 */

const drawOnDeath = fx('ON_DEATH', [a('DRAW', 'PLAYER', { value: 1 })]);
const reflect = (value: number) =>
  fx('PASSIVE', [a('REFLECT_DAMAGE', 'SELF', { value })]);
const releve2 = fx('PASSIVE', [a('RELEVE', 'SELF', { value: 2 })]);
const taunt = fx('ON_SUMMON', [a('SET_TAUNT', 'SELF', { value: 1 })]);

/** État actuel d'une carte (base de prod, après les patchs précédents). */
const card = (
  name: string,
  description: string,
  atk: number,
  hp: number,
  cost: number,
  effects: CardEffect[],
): BalanceFields => ({ name, description, atk, hp, cost, effects });

const TACTIQUE = card(
  'Tactique Gang Gang',
  'La stratégie de groupe signée Ouille. Tous vos monstres gagnent +300 ATK.',
  0,
  0,
  0,
  [fx('PASSIVE', [a('BUFF_ATK', 'ALL_ALLIES', { value: 300 })])],
);
const FORCE_DELTA = card(
  'Force Delta',
  'Frappe de suppression. Jouable seulement si vous contrôlez Noyau Delta : détruit un monstre adverse de votre choix.',
  0,
  0,
  0,
  [
    fx('ON_PLAY', [a('DESTROY_MONSTER', 'ENEMY_MONSTER')], {
      type: 'SPECIFIC_CARD_ON_BOARD',
      value: 'Noyau Delta',
    }),
  ],
);
const PATCH = card(
  'Mise à jour .patch',
  "Le compte à rebours repart. Remet à 3 le compteur de tes virus implantés chez l'adversaire.",
  0,
  0,
  0,
  [fx('ON_PLAY', [a('RESET_TURN_COUNTER', 'PLAYER', { value: 3 })])],
);
const CANON = card(
  'Canon à Particules .vxd',
  "Dégâts directs. Augmente l'ATK de 400 et confère l'Attaque Perçante.",
  400,
  0,
  0,
  [
    fx('PASSIVE', [a('BUFF_ATK', 'SELF', { value: 400 })]),
    fx('ON_PLAY', [a('SET_PIERCING', 'SELF', { value: 1 })]),
  ],
);
const SURCHARGE = card(
  'Surcharge Overclock',
  'Boost instable. Donne +500 ATK temporaire à tous vos monstres ce tour.',
  0,
  0,
  0,
  [fx('ON_PLAY', [a('BUFF_ATK_TEMP', 'ALL_ALLIES', { value: 500 })])],
);
const OEUF = card(
  'Œuf Céleste',
  'Couvé par les étoiles. Après 4 tours, il éclot directement en Drakon Adulte de ton choix. À protéger à tout prix.',
  0,
  1500,
  2,
  [
    fx('ON_SUMMON', [
      a('SET_HATCH_COUNTER', 'SELF', { value: 4, filter: { stage: 'adult' } }),
    ]),
  ],
);
const BEBE_TEROS = card(
  'Bébé Teros',
  'Petit mur de pierre. Provocation.',
  100,
  1000,
  1,
  [fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')])],
);
const JEUNE_TEROS = card(
  'Jeune Teros',
  'Rocaille résistante. Provocation, dégâts reçus divisés par 2.',
  300,
  1800,
  2,
  [
    fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')]),
    fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
  ],
);
const ADULTE_TEROS = card(
  'Adulte Teros',
  'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses.',
  600,
  3000,
  3,
  [
    fx('ON_SUMMON', [a('SET_TAUNT', 'SELF'), a('SET_DEBUFF_IMMUNITY', 'SELF')]),
    fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
  ],
);
const SENTINELLE = card(
  'Sentinelle Gargouille',
  'Veille sur la brigade sans jamais ciller. Provocation.',
  100,
  1000,
  1,
  [taunt],
);
const GRIBOUILLE = card(
  'Capitaine Gribouille',
  'Leader de la Brigade Ouille, reconnu pour sa noble manie de protéger son prochain.',
  500,
  1100,
  2,
  [taunt],
);
const MASTODONTE = card(
  'Mastodonte Grossebouille',
  'Une montagne de tendresse.',
  700,
  1700,
  3,
  [
    fx('ON_SUMMON', [
      a('SET_TAUNT', 'SELF', { value: 1 }),
      a('FORCE_ATTACK_MODE', 'SELF', { value: 1 }),
    ]),
  ],
);
const NOYAU_ALPHA = card(
  'Noyau Alpha',
  'Noyau de défense absolu. Provocation permanente, encaisse tout en mode Garde.',
  100,
  2200,
  2,
  [taunt, fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })])],
);
const CHATOUILLE = card(
  'Général Chatouille',
  'Ancien membre de la brigade Ouille. Sa puissance équivaut à une brigade entière. Souvent en expédition dans les grottes oubliées.',
  800,
  1500,
  3,
  [
    fx('ON_BATTLE_PHASE_START', [
      a('BUFF_ATK_TEMP', 'ALLIES_EXCEPT_SELF', { value: 200 }),
    ]),
  ],
);
const CHAMPION = card(
  'Champion Ouille-Ouille',
  'Le héros de la légende.',
  900,
  1800,
  3,
  [fx('PASSIVE', [a('BUFF_HP', 'ADJACENT_ALLIES', { value: 300 })])],
);

const add = (b: BalanceFields, ...more: CardEffect[]): CardEffect[] => [
  ...(b.effects ?? []),
  ...more,
];

export const GARDE_PATCHES: BalancePatch[] = [
  tweak(TACTIQUE, {
    description:
      'La stratégie de groupe signée Ouille. Vos monstres Pipou gagnent +300 ATK. Un seul exemplaire en jeu.',
    effects: [
      fx('PASSIVE', [a('BUFF_ATK', 'ARCHETYPE_ALLIES', { value: 300 })]),
    ],
  }),
  tweak(FORCE_DELTA, {
    name: 'Force Plasma',
    description:
      'Frappe de suppression. Jouable seulement si vous contrôlez un Noyau : inflige 1500 dégâts à un monstre adverse de votre choix.',
    effects: [
      fx('ON_PLAY', [a('DEAL_DAMAGE', 'ENEMY_MONSTER', { value: 1500 })], {
        type: 'SPECIFIC_CARD_ON_BOARD',
        value: 'Noyau',
        match: 'contains',
      }),
    ],
  }),
  tweak(PATCH, {
    description:
      "Le compte à rebours repart. Remet à 3 le compteur de tes virus implantés chez l'adversaire et récupère jusqu'à 2 monstres Pixelman de ton cimetière.",
    effects: [
      fx('ON_PLAY', [
        a('RESET_TURN_COUNTER', 'PLAYER', { value: 3 }),
        a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
          value: 2,
          filter: { type: 'monster', archetype: 'pixelman' },
        }),
      ]),
    ],
  }),
  tweak(CANON, {
    description:
      "Dégâts directs. Augmente l'ATK de 250 et confère l'Attaque Perçante.",
    atk: 250,
    effects: [
      fx('PASSIVE', [a('BUFF_ATK', 'SELF', { value: 250 })]),
      fx('ON_PLAY', [a('SET_PIERCING', 'SELF', { value: 1 })]),
    ],
  }),
  tweak(SURCHARGE, {
    description:
      'Boost instable. Donne +500 ATK temporaire à tous vos monstres ce tour, mais ils subissent 200 dégâts.',
    effects: [
      fx('ON_PLAY', [
        a('BUFF_ATK_TEMP', 'ALL_ALLIES', { value: 500 }),
        a('DEAL_DAMAGE', 'ALL_ALLIES', { value: 200 }),
      ]),
    ],
  }),
  tweak(OEUF, {
    description:
      'Couvé par les étoiles. Après 3 tours, il éclot en Drakon Adulte de ton choix. En attendant, soigne tes Drakons de 200 PV au début de chacun de tes tours.',
    cost: 1,
    effects: [
      fx('ON_SUMMON', [
        a('SET_HATCH_COUNTER', 'SELF', {
          value: 3,
          filter: { stage: 'adult' },
        }),
      ]),
      fx('ON_TURN_START', [a('HEAL', 'ARCHETYPE_ALLIES', { value: 200 })]),
    ],
  }),
  tweak(BEBE_TEROS, {
    description:
      'Petit mur de pierre. Provocation, renvoie 40 % des dégâts reçus. Détruit : vous piochez 1 carte.',
    hp: 1300,
    effects: add(BEBE_TEROS, reflect(40), drawOnDeath),
  }),
  tweak(JEUNE_TEROS, {
    description:
      'Rocaille résistante. Provocation, dégâts reçus divisés par 2, renvoie 40 % des dégâts reçus. Détruit : vous piochez 1 carte.',
    effects: add(JEUNE_TEROS, reflect(40), drawOnDeath),
  }),
  tweak(ADULTE_TEROS, {
    description:
      'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses, renvoie 50 % des dégâts reçus. Détruit : vous piochez 1 carte.',
    effects: add(ADULTE_TEROS, reflect(50), drawOnDeath),
  }),
  tweak(SENTINELLE, {
    description:
      'Veille sur la brigade sans jamais ciller. Provocation. Détruite : vous piochez 1 carte.',
    hp: 1300,
    effects: add(SENTINELLE, drawOnDeath),
  }),
  tweak(GRIBOUILLE, {
    description:
      'Leader de la Brigade Ouille, reconnu pour sa noble manie de protéger son prochain. Provocation. Détruit : vous piochez 1 carte.',
    effects: add(GRIBOUILLE, drawOnDeath),
  }),
  tweak(MASTODONTE, {
    description:
      'Une montagne de tendresse. Provocation. Relève (2) : peut prendre la place de 2 alliés Pipou. Détruit : vous piochez 1 carte.',
    effects: add(MASTODONTE, releve2, drawOnDeath),
  }),
  tweak(NOYAU_ALPHA, {
    description:
      'Noyau de défense absolu. Provocation permanente, encaisse tout en mode Garde. Détruit : vous piochez 1 carte.',
    effects: add(NOYAU_ALPHA, drawOnDeath),
  }),
  tweak(CHATOUILLE, {
    description:
      'Ancien membre de la brigade Ouille. Sa puissance équivaut à une brigade entière. Relève (2) : peut prendre la place de 2 alliés Pipou.',
    effects: add(CHATOUILLE, releve2),
  }),
  tweak(CHAMPION, {
    description:
      'Le héros de la légende. Relève (2) : peut prendre la place de 2 alliés Pipou.',
    effects: add(CHAMPION, releve2),
  }),
];
