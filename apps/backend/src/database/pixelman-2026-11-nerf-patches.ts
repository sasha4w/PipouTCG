import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';
import { BLUETOOTH_EFFECTS } from './cartes-2026-11-patches';

/**
 * Patch 2026-11 : la brûlure de Noyau Beta devient dégressive (300 pour le
 * premier exemplaire, 100 pour les suivants : trois Beta nettoyaient n'importe
 * quel terrain à 900 par tour), le Module Bluetooth .v2 sur Beta tombe de 600
 * à 300 dégâts, et la copie de DuplicateX disparaît avec son original (règle
 * du moteur : seul le texte change ici).
 */

/** Dégâts du Module Bluetooth .v2 équipé sur Noyau Beta. */
const BLUETOOTH_BETA_DAMAGE = 300;

export const PIXELMAN_NERF_PATCHES: BalancePatch[] = [
  tweak(
    {
      name: 'Noyau Beta',
      description:
        'Noyau corrupteur. Ronge les vies des monstres adverses tour après tour.',
      atk: 500,
      hp: 1200,
      cost: 2,
      effects: [
        fx('ON_TURN_START', [a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 300 })]),
      ],
    },
    {
      description:
        'Noyau corrupteur. Au début de ton tour, inflige 300 dégâts à tous les monstres adverses. Chaque Noyau Beta supplémentaire sur ton terrain n’en inflige que 100.',
      effects: [
        fx('ON_TURN_START', [
          a('DEAL_DAMAGE', 'ALL_ENEMIES', {
            value: 100,
            valueIf: { condition: { type: 'FIRST_COPY_ON_BOARD' }, value: 300 },
          }),
        ]),
      ],
    },
  ),
  tweak(
    {
      name: 'Module Bluetooth .v2',
      description:
        "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige une seule fois 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.",
      atk: 0,
      hp: 0,
      cost: 0,
      effects: BLUETOOTH_EFFECTS,
    },
    {
      description: `Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige une seule fois ${BLUETOOTH_BETA_DAMAGE} dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.`,
      effects: BLUETOOTH_EFFECTS.map((e) =>
        e.trigger === 'ON_PLAY'
          ? {
              ...e,
              actions: e.actions.map((act) => ({
                ...act,
                value: BLUETOOTH_BETA_DAMAGE,
              })),
            }
          : e,
      ),
    },
  ),
  tweak(
    {
      name: 'DuplicateX',
      description:
        'Copier-coller du réel. Un de tes monstres est copié sur ta première zone libre ; la copie ne peut pas attaquer pendant 2 tours.',
      atk: 0,
      hp: 0,
      cost: 0,
      effects: [
        fx('ON_PLAY', [a('DUPLICATE_MONSTER', 'TARGET_ALLY', { value: 2 })]),
      ],
    },
    {
      description:
        "Copier-coller du réel. Un de tes monstres est copié sur ta première zone libre ; la copie ne peut pas attaquer pendant 2 tours et disparaît si l'original est détruit.",
    },
  ),
];
