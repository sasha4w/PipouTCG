import type { CardEffect } from '@pipou/shared';
import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';
import type { ChargeNewCard } from './cartes-2026-11-patches';
import { IMMUNITY_PATCHES } from './immunities-2026-10-patches';

/**
 * Patch 2026-11 : Maître Magouille et Noyau Delta au niveau du Drakon des
 * Origines, avec condition d'invocation, et la Charge Protocole Delta .core.
 * Les `before` reprennent la base après les immunités d'octobre (migration 017).
 */

const MAGOUILLE = IMMUNITY_PATCHES.find(
  (p) => p.cardName === 'Maître Magouille',
)!;

/** Immunités actuelles de Magouille (ON_SUMMON), reprises telles quelles. */
const ALL_IMMUNITIES: CardEffect = MAGOUILLE.after[0];

export const MAGOUILLE_EFFECTS: CardEffect[] = [
  fx('PASSIVE', [
    a('SUMMON_IF_GRAVEYARD_COUNT', 'SELF', {
      value: 4,
      filter: {
        archetype: 'pipou',
        type: 'monster',
        rarities: ['epic', 'legendary'],
      },
    }),
  ]),
  ALL_IMMUNITIES,
  fx('ON_SUMMON', [
    a('HEAL', 'ALL_ALLIES', { value: 500 }),
    a('BUFF_ATK_TEMP', 'ALL_ALLIES', { value: 300 }),
  ]),
];

export const DELTA_EFFECTS: CardEffect[] = [
  fx('PASSIVE', [a('SUMMON_ONLY_BY_EFFECT', 'SELF')]),
  fx('ON_SUMMON', [a('SET_PIERCING', 'SELF', { value: 1 })]),
  ALL_IMMUNITIES,
  fx('PASSIVE', [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })]),
];

export const SECRETES_PATCHES: BalancePatch[] = [
  tweak(
    {
      name: 'Maître Magouille',
      description: MAGOUILLE.descriptionAfter,
      atk: 500,
      hp: 2000,
      cost: 3,
      effects: MAGOUILLE.after,
    },
    {
      atk: 1200,
      hp: 3500,
      cost: 4,
      effects: MAGOUILLE_EFFECTS,
      description:
        'Membre fondateur de la PipouSquad. Invocable seulement avec 4 monstres Pipou Épiques ou Légendaires dans ton cimetière. Insensible à tous les effets adverses ; à son arrivée, soigne tes monstres de 500 PV et leur donne +300 ATK ce tour.',
    },
  ),
  tweak(
    {
      name: 'Noyau Delta',
      description:
        "Noyau d'extermination. Frappe de façon perçante et ignore la Garde.",
      atk: 1300,
      hp: 800,
      cost: 3,
      effects: [fx('ON_SUMMON', [a('SET_PIERCING', 'SELF', { value: 1 })])],
    },
    {
      atk: 1800,
      hp: 2500,
      cost: 4,
      effects: DELTA_EFFECTS,
      description:
        'Le noyau ultime. Ne s’invoque que par Protocole Delta .core. Attaque Perçante, attaque deux fois par tour, insensible aux effets adverses.',
    },
  ),
];

export const PROTOCOLE_DELTA: ChargeNewCard = {
  name: 'Protocole Delta .core',
  rarity: 'epic',
  archetype: 'pixelman',
  setOf: 'Noyau Alpha',
  chargeMax: 4,
  chargeMode: 'ONE_SHOT',
  description:
    'Compilation du noyau ultime. +1 compteur à chaque équipement que tu poses. À 4 : invoque Noyau Delta depuis ta main ou ton deck ; si ton terrain est plein, envoie d’abord un de tes monstres au cimetière.',
  effects: [
    fx('PASSIVE', [a('CHARGE_ON_EQUIPMENT', 'SELF')]),
    fx('ON_CHARGED', [
      a('SUMMON_NAMED', 'PLAYER', { filter: { name: 'Noyau Delta' } }),
    ]),
  ],
};
