import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalanceFields, BalancePatch } from './balance-2026-10-patches';

/**
 * Appel des ancêtres ne récupère plus un autre Appel des ancêtres : deux
 * exemplaires au cimetière se rejouaient en boucle (partie de test du 2026-10-31).
 */

/** État actuel de la carte (base de prod, après le rééquilibrage 2026-10). */
const APPEL: BalanceFields = {
  name: 'Appel des ancêtres',
  description:
    "La lignée répond à l'appel. Récupère 2 cartes Drakon de ton cimetière.",
  atk: 0,
  hp: 0,
  cost: 0,
  effects: [
    fx('ON_PLAY', [
      a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
        value: 2,
        filter: { archetype: 'dragon' },
      }),
    ]),
  ],
};

export const ANCETRES_PATCHES: BalancePatch[] = [
  tweak(APPEL, {
    description:
      "La lignée répond à l'appel. Récupère 2 cartes Drakon de ton cimetière, sauf Appel des ancêtres.",
    effects: [
      fx('ON_PLAY', [
        a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
          value: 2,
          filter: { archetype: 'dragon', excludeName: 'Appel des ancêtres' },
        }),
      ]),
    ],
  }),
];
