import type { CardEffect, EffectCondition, Rarity } from '@pipou/shared';
import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';

/**
 * Patch 2026-11 : textes clarifiés (Module Bluetooth .v2, Œuf Céleste) et
 * cartes Charge (Alerte générale, Extraction de données, Méditation céleste).
 * Les `before` reprennent l'état de la base après les patchs d'octobre.
 */

const equippedOn = (value: string): EffectCondition => ({
  type: 'EQUIPPED_ON',
  value,
});

const BLUETOOTH_EFFECTS: CardEffect[] = [
  fx(
    'PASSIVE',
    [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })],
    equippedOn('Noyau Alpha'),
  ),
  fx(
    'ON_PLAY',
    [a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 600 })],
    equippedOn('Noyau Beta'),
  ),
  fx(
    'PASSIVE',
    [a('BUFF_ATK', 'SELF', { value: 600 })],
    equippedOn('Noyau Delta'),
  ),
  fx(
    'PASSIVE',
    [a('VIRUS_ATK_DEBUFF', 'SELF', { value: 600 })],
    equippedOn('Noyau Zeta'),
  ),
];

const OEUF_CELESTE_EFFECTS: CardEffect[] = [
  fx('ON_SUMMON', [
    a('SET_HATCH_COUNTER', 'SELF', { value: 3, filter: { stage: 'adult' } }),
  ]),
  fx('ON_TURN_START', [a('HEAL', 'ARCHETYPE_ALLIES', { value: 200 })]),
];

export const NOVEMBER_PATCHES: BalancePatch[] = [
  tweak(
    {
      name: 'Module Bluetooth .v2',
      description:
        "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.",
      atk: 0,
      hp: 0,
      cost: 0,
      effects: BLUETOOTH_EFFECTS,
    },
    {
      description:
        "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige une seule fois 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.",
    },
  ),
  tweak(
    {
      name: 'Œuf Céleste',
      description:
        'Couvé par les étoiles. Après 3 tours, il éclot en Drakon Adulte de ton choix. En attendant, soigne tes Drakons de 200 PV au début de chacun de tes tours.',
      atk: 0,
      hp: 1500,
      cost: 1,
      effects: OEUF_CELESTE_EFFECTS,
    },
    {
      description:
        'Couvé par les étoiles. Après 3 tours, il éclot en Drakon Adulte de ton choix (deck ou cimetière ; à défaut un Jeune, puis un Bébé). En attendant, soigne tes Drakons de 200 PV au début de chacun de tes tours.',
    },
  ),
];

export interface ChargeNewCard {
  name: string;
  rarity: Rarity;
  archetype: 'pipou' | 'pixelman' | 'dragon';
  /** Nom d'une carte du set visé : la nouvelle carte rejoint son set. */
  setOf: string;
  chargeMax: number;
  chargeMode: 'ONE_SHOT' | 'CYCLIC';
  description: string;
  effects: CardEffect[];
}

export const CHARGE_NEW_CARDS: ChargeNewCard[] = [
  {
    name: 'Alerte générale',
    rarity: 'legendary',
    archetype: 'pipou',
    setOf: 'Général Chatouille',
    chargeMax: 3,
    chargeMode: 'ONE_SHOT',
    description:
      'Le Général sonne le rassemblement. Se pose seulement avec Général Chatouille sur le terrain et se dissipe s’il le quitte. Après 3 tours : tes monstres attaquent une fois de plus ce tour.',
    effects: [
      fx('PASSIVE', [
        a('REQUIRES_CARD_ON_BOARD', 'SELF', {
          filter: { name: 'Général Chatouille' },
        }),
      ]),
      fx('ON_CHARGED', [a('GRANT_EXTRA_ATTACK', 'ALL_ALLIES', { value: 1 })]),
    ],
  },
  {
    name: 'Extraction de données',
    rarity: 'epic',
    archetype: 'pixelman',
    setOf: 'Noyau Alpha',
    chargeMax: 2,
    chargeMode: 'CYCLIC',
    description:
      "Siphon réseau. Tous les 2 tours : prends la moitié de l'ATK d'un monstre de ton choix et donne-la à un de tes Noyaux pour ce tour.",
    effects: [
      fx('ON_CHARGED', [
        a('TRANSFER_HALF_ATK', 'PLAYER', {
          filter: { name: 'Noyau', archetype: 'pixelman' },
        }),
      ]),
    ],
  },
  {
    name: 'Méditation céleste',
    rarity: 'epic',
    archetype: 'dragon',
    setOf: 'Bébé Teros',
    chargeMax: 3,
    chargeMode: 'ONE_SHOT',
    description:
      "L'esprit précède les écailles. Après 3 tours : un de tes Drakons évolue au stade suivant, sans avoir besoin de la carte.",
    effects: [
      fx('ON_CHARGED', [
        a('FORCE_EVOLVE', 'PLAYER', { filter: { archetype: 'dragon' } }),
      ]),
    ],
  },
];
