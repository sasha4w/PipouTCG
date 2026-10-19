import type {
  CardEffect,
  EffectAction,
  EffectCondition,
  Rarity,
  SupportType,
} from '@pipou/shared';
import { canonicalEffects, type PatchDecision } from './card-effect-patches';

/** Champs d'une carte touchés par le rééquilibrage Drakon / Pixelman / Zeta. */
export interface BalanceFields {
  name: string;
  description: string | null;
  atk: number;
  hp: number;
  cost: number;
  effects: CardEffect[] | null;
}

export interface BalancePatch {
  before: BalanceFields;
  after: BalanceFields;
}

export interface BalanceNewCard {
  name: string;
  rarity: Rarity;
  type: 'monster' | 'support';
  supportType: SupportType | null;
  archetype: 'dragon' | 'pixelman';
  /** Nom d'une carte du set visé : la nouvelle carte rejoint son set. */
  setOf: string;
  atk: number;
  hp: number;
  cost: number;
  description: string;
  effects: CardEffect[];
}

const fx = (
  trigger: CardEffect['trigger'],
  actions: EffectAction[],
  condition: EffectCondition | null = null,
): CardEffect => ({ trigger, condition, actions });
const a = (
  type: EffectAction['type'],
  target: EffectAction['target'],
  extra: Partial<EffectAction> = {},
): EffectAction => ({ type, target, ...extra });
const equippedOn = (value: string): EffectCondition => ({
  type: 'EQUIPPED_ON',
  value,
});

/** Change seulement les valeurs données ; le reste est identique avant/après. */
const tweak = (
  before: BalanceFields,
  changes: Partial<BalanceFields>,
): BalancePatch => ({ before, after: { ...before, ...changes } });

const FIREWALL_SURCHARGE_BEFORE: CardEffect[] = [
  fx('ON_PLAY', [a('SET_COMBAT_IMMUNITY', 'SELF')], equippedOn('Noyau Alpha')),
  fx(
    'PASSIVE',
    [a('SET_SUPPORT_DESTROY_IMMUNITY', 'SELF')],
    equippedOn('Noyau Beta'),
  ),
  fx('PASSIVE', [a('IGNORE_TAUNT', 'SELF')], equippedOn('Noyau Delta')),
];

const BLUETOOTH_BEFORE: CardEffect[] = [
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
];

const REPARATION_BEFORE: CardEffect[] = [
  fx('ON_TURN_START', [a('HEAL', 'SELF', { value: 200 })]),
];

const ZETA_BEFORE: CardEffect[] = [
  fx('ON_SUMMON', [a('SET_TURN_COUNTER', 'SELF', { value: 3 })]),
  fx('PASSIVE', [a('SUMMONABLE_ON_ENEMY_SIDE', 'SELF')]),
];

/** `before` : valeurs de la base locale `cardcollect` (2026-10-19). */
export const BALANCE_PATCHES: BalancePatch[] = [
  tweak(
    {
      name: 'Œuf de la Genèse',
      description:
        "Un œuf ancestral. Un Jeune Drakon de n'importe quel élément peut éclore directement de lui ; sinon, après 2 tours, il donne naissance au Bébé Drakon de ton choix.",
      atk: 0,
      hp: 300,
      cost: 1,
      effects: [
        fx('ON_SUMMON', [
          a('SET_HATCH_COUNTER', 'SELF', {
            value: 2,
            filter: { stage: 'baby' },
          }),
        ]),
        fx('PASSIVE', [a('EVOLUTION_JOKER', 'SELF')]),
      ],
    },
    { hp: 900 },
  ),
  tweak(
    {
      name: 'Œuf de la Dualité',
      description:
        "Deux destins dans une coquille. S'il est détruit, un Jeune Drakon de ton choix surgit ; s'il survit 2 tours, il éclot en Bébé Drakon.",
      atk: 0,
      hp: 300,
      cost: 1,
      effects: [
        fx('ON_SUMMON', [
          a('SET_HATCH_COUNTER', 'SELF', {
            value: 2,
            filter: { stage: 'baby' },
          }),
        ]),
        fx('ON_DEATH', [
          a('SUMMON_FROM_DECK', 'PLAYER', { filter: { stage: 'young' } }),
        ]),
      ],
    },
    { hp: 900 },
  ),
  tweak(
    {
      name: 'Œuf Céleste',
      description:
        'Couvé par les étoiles. Après 4 tours, il éclot directement en Drakon Adulte de ton choix. À protéger à tout prix.',
      atk: 0,
      hp: 600,
      cost: 2,
      effects: [
        fx('ON_SUMMON', [
          a('SET_HATCH_COUNTER', 'SELF', {
            value: 4,
            filter: { stage: 'adult' },
          }),
        ]),
      ],
    },
    { hp: 1500 },
  ),
  tweak(
    {
      name: 'Incubation Rapide',
      description:
        "Accélère l'éclosion d'un de tes Œufs de 2 tours, ou permet à un de tes Drakons d'évoluer ce tour.",
      atk: 0,
      hp: 0,
      cost: 1,
      effects: [
        fx('ON_PLAY', [
          a('ADVANCE_HATCH', 'TARGET_ALLY', { value: 2 }),
          a('ALLOW_EVOLUTION_THIS_TURN', 'TARGET_ALLY'),
        ]),
      ],
    },
    { cost: 0 },
  ),
  tweak(
    {
      name: 'Souffle Primordial',
      description:
        'Tes Drakons gagnent +300 ATK ce tour, +600 si tu contrôles un Drakon Adulte.',
      atk: 0,
      hp: 0,
      cost: 2,
      effects: [
        fx('ON_PLAY', [
          a('BUFF_ATK_TEMP', 'ARCHETYPE_ALLIES', {
            value: 300,
            archetype: 'dragon',
            valueIf: {
              condition: { type: 'DRAKON_ON_BOARD', stage: 'adult' },
              value: 600,
            },
          }),
        ]),
      ],
    },
    { cost: 0 },
  ),
  tweak(
    {
      name: 'Écaille de Dragon',
      description:
        'Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux effets adverses.',
      atk: 0,
      hp: 400,
      cost: 1,
      effects: [
        fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
        fx('PASSIVE', [a('SET_DEBUFF_IMMUNITY', 'SELF')], {
          type: 'EQUIPPED_ON',
          stage: 'egg',
        }),
      ],
    },
    { cost: 0, hp: 0 },
  ),
  tweak(
    {
      name: 'Module de Réparation .exe',
      description:
        'Patch correctif. Soigne le porteur de 200 HP chaque début de tour.',
      atk: 0,
      hp: 400,
      cost: 0,
      effects: REPARATION_BEFORE,
    },
    {
      description:
        'Patch correctif. Le porteur gagne +400 PV max et récupère 200 HP chaque début de tour.',
      effects: [
        ...REPARATION_BEFORE,
        fx('PASSIVE', [a('BUFF_HP', 'SELF', { value: 400 })]),
      ],
    },
  ),
  tweak(
    {
      name: 'Firewall .sys',
      description:
        'Sécurité réseau. Réduit de moitié les dégâts reçus par le porteur.',
      atk: 0,
      hp: 600,
      cost: 0,
      effects: [
        fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
      ],
    },
    { hp: 0 },
  ),
  tweak(
    {
      name: 'Surcharge Overclock',
      description:
        'Boost instable. Donne +500 ATK temporaire à tous vos monstres ce tour.',
      atk: 500,
      hp: 0,
      cost: 0,
      effects: [
        fx('ON_PLAY', [a('BUFF_ATK_TEMP', 'ALL_ALLIES', { value: 500 })]),
      ],
    },
    { atk: 0 },
  ),
  tweak(
    {
      name: 'Force Delta',
      description:
        'Frappe de suppression. Détruit un monstre adverse de votre choix.',
      atk: 0,
      hp: 0,
      cost: 0,
      effects: [fx('ON_PLAY', [a('DESTROY_MONSTER', 'ENEMY_MONSTER')])],
    },
    {
      description:
        'Frappe de suppression. Jouable seulement si vous contrôlez Noyau Delta : détruit un monstre adverse de votre choix.',
      effects: [
        fx('ON_PLAY', [a('DESTROY_MONSTER', 'ENEMY_MONSTER')], {
          type: 'SPECIFIC_CARD_ON_BOARD',
          value: 'Noyau Delta',
        }),
      ],
    },
  ),
  tweak(
    {
      name: 'Formatage .exe',
      description:
        "Libère instantanément une zone en détruisant l'un de vos propres monstres.",
      atk: 0,
      hp: 0,
      cost: 0,
      effects: [fx('ON_PLAY', [a('DESTROY_MONSTER', 'TARGET_ALLY')])],
    },
    {
      description:
        "Libère instantanément une zone en détruisant l'un de vos propres monstres, puis récupérez un monstre Pixelman de votre cimetière.",
      effects: [
        fx('ON_PLAY', [
          a('DESTROY_MONSTER', 'TARGET_ALLY'),
          a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
            value: 1,
            filter: { archetype: 'pixelman', type: 'monster' },
          }),
        ]),
      ],
    },
  ),
  tweak(
    {
      name: 'Noyau Zeta',
      description:
        "Virus à durée limitée. S'autodétruit après 3 tours du poseur — qui récupère alors une Prime. Bloque une zone adverse.",
      atk: 0,
      hp: 400,
      cost: 2,
      effects: ZETA_BEFORE,
    },
    {
      hp: 1200,
      description:
        "Virus à durée limitée. Bloque une zone adverse et retire 300 ATK aux monstres de l'hôte. Après 3 tours du poseur, il explose : 500 dégâts à tous les monstres adverses, et le poseur récupère une Prime.",
      effects: [
        ...ZETA_BEFORE,
        fx('PASSIVE', [a('VIRUS_ATK_DEBUFF', 'SELF', { value: 300 })]),
        fx('ON_SELF_DESTRUCT', [
          a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 500 }),
        ]),
      ],
    },
  ),
  tweak(
    {
      name: 'Firewall de Surcharge .sys',
      description:
        "Sur Alpha : à l'équipement, insensible aux dégâts de combat jusqu'à votre prochain tour. Sur Beta : ne peut pas être détruit par une carte Support. Sur Delta : ignore la Provocation.",
      atk: 0,
      hp: 0,
      cost: 0,
      effects: FIREWALL_SURCHARGE_BEFORE,
    },
    {
      description:
        "Sur Alpha : à l'équipement, insensible aux dégâts de combat jusqu'à votre prochain tour. Sur Beta : ne peut pas être détruit par une carte Support. Sur Delta : ignore la Provocation. Sur Zeta : il ne peut pas être désinfecté.",
      effects: [
        ...FIREWALL_SURCHARGE_BEFORE,
        fx(
          'ON_PLAY',
          [a('SET_DISINFECT_IMMUNITY', 'SELF')],
          equippedOn('Noyau Zeta'),
        ),
      ],
    },
  ),
  tweak(
    {
      name: 'Module Bluetooth .v2',
      description:
        "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK.",
      atk: 0,
      hp: 0,
      cost: 0,
      effects: BLUETOOTH_BEFORE,
    },
    {
      description:
        "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.",
      effects: [
        ...BLUETOOTH_BEFORE,
        fx(
          'PASSIVE',
          [a('VIRUS_ATK_DEBUFF', 'SELF', { value: 600 })],
          equippedOn('Noyau Zeta'),
        ),
      ],
    },
  ),
];

export const BALANCE_NEW_CARDS: BalanceNewCard[] = [
  {
    name: 'Mont Drakon',
    rarity: 'epic',
    type: 'support',
    supportType: 'TERRAIN',
    archetype: 'dragon',
    setOf: 'Bébé Teros',
    atk: 0,
    hp: 0,
    cost: 0,
    description:
      'Le berceau des dragons. Au début de ton tour, récupère un monstre Drakon de ton cimetière ou de ton deck.',
    effects: [
      fx('ON_TURN_START', [
        a('RETURN_FROM_GRAVEYARD_OR_DECK', 'PLAYER', {
          filter: { archetype: 'dragon', type: 'monster' },
        }),
      ]),
    ],
  },
  {
    name: 'Appel des ancêtres',
    rarity: 'rare',
    type: 'support',
    supportType: 'EPHEMERAL',
    archetype: 'dragon',
    setOf: 'Bébé Teros',
    atk: 0,
    hp: 0,
    cost: 0,
    description:
      "La lignée répond à l'appel. Récupère 2 cartes Drakon de ton cimetière.",
    effects: [
      fx('ON_PLAY', [
        a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
          value: 2,
          filter: { archetype: 'dragon' },
        }),
      ]),
    ],
  },
  {
    name: 'Restauration .bak',
    rarity: 'rare',
    type: 'support',
    supportType: 'EPHEMERAL',
    archetype: 'pixelman',
    setOf: 'Noyau Alpha',
    atk: 0,
    hp: 0,
    cost: 0,
    description:
      'Sauvegarde retrouvée. Récupère un Noyau de ton cimetière ou de ton deck.',
    effects: [
      fx('ON_PLAY', [
        a('RETURN_FROM_GRAVEYARD_OR_DECK', 'PLAYER', {
          filter: { name: 'Noyau', archetype: 'pixelman' },
        }),
      ]),
    ],
  },
  {
    name: 'DuplicateX',
    rarity: 'legendary',
    type: 'support',
    supportType: 'EPHEMERAL',
    archetype: 'pixelman',
    setOf: 'Noyau Alpha',
    atk: 0,
    hp: 0,
    cost: 0,
    description:
      'Copier-coller du réel. Un de tes monstres est copié sur ta première zone libre ; la copie ne peut pas attaquer pendant 2 tours.',
    effects: [
      fx('ON_PLAY', [a('DUPLICATE_MONSTER', 'TARGET_ALLY', { value: 2 })]),
    ],
  },
  {
    name: 'Mise à jour .patch',
    rarity: 'rare',
    type: 'support',
    supportType: 'EPHEMERAL',
    archetype: 'pixelman',
    setOf: 'Noyau Alpha',
    atk: 0,
    hp: 0,
    cost: 0,
    description:
      "Le compte à rebours repart. Remet à 3 le compteur de tes virus implantés chez l'adversaire.",
    effects: [fx('ON_PLAY', [a('RESET_TURN_COUNTER', 'PLAYER', { value: 3 })])],
  },
];

function fingerprint(f: {
  name: string;
  description: string | null;
  atk: number;
  hp: number;
  cost: number;
  effects: unknown;
}): string {
  return JSON.stringify([
    f.name,
    f.description ?? null,
    Number(f.atk),
    Number(f.hp),
    Number(f.cost),
    canonicalEffects(f.effects ?? null),
  ]);
}

/** Même garde que planDrakonPatch : n'écrase jamais une carte modifiée à la main. */
export function planBalancePatch(
  current: Parameters<typeof fingerprint>[0] | undefined,
  patch: BalancePatch,
  direction: 'up' | 'down',
): PatchDecision {
  if (!current) return 'skip-diverged';
  const [from, to] =
    direction === 'up'
      ? [patch.before, patch.after]
      : [patch.after, patch.before];
  const actual = fingerprint(current);
  if (actual === fingerprint(to)) return 'already-done';
  if (actual === fingerprint(from)) return 'apply';
  return 'skip-diverged';
}
