import type {
  CardEffect,
  DrakonElement,
  DrakonStage,
  EffectAction,
  EffectCondition,
  Rarity,
} from '@pipou/shared';
import { canonicalEffects, type PatchDecision } from './card-effect-patches';

export interface DrakonFields {
  name: string;
  description: string | null;
  hp: number;
  effects: CardEffect[] | null;
  element: DrakonElement | null;
  lineage: string | null;
  stage: DrakonStage | null;
}

export interface DrakonPatch {
  before: DrakonFields;
  after: DrakonFields;
}

export interface DrakonNewCard {
  name: string;
  rarity: Rarity;
  cost: number;
  hp: number;
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

/** Carte Drakon de l'export (effets vides, sans élément) → nouvel état. */
const rework = (
  name: string,
  hp: number,
  oldDescription: string,
  after: Partial<DrakonFields> & Pick<DrakonFields, 'description' | 'effects'>,
): DrakonPatch => ({
  before: {
    name,
    description: oldDescription,
    hp,
    effects: null,
    element: null,
    lineage: null,
    stage: null,
  },
  after: {
    name,
    hp,
    element: null,
    lineage: null,
    stage: null,
    ...after,
  },
});

export const DRAKON_PATCHES: DrakonPatch[] = [
  rework(
    'Œuf de la Gènese',
    0,
    "Que peut-il bien se cacher à l'intérieur de cet Œuf ?",
    {
      name: 'Œuf de la Genèse',
      hp: 300,
      stage: 'egg',
      description:
        "Un œuf ancestral. Un Jeune Drakon de n'importe quel élément peut éclore directement de lui ; sinon, après 2 tours, il donne naissance au Bébé Drakon de ton choix.",
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
  ),
  rework('Bébé Teros', 1000, 'Petit mur de pierre.', {
    element: 'earth',
    lineage: 'teros',
    stage: 'baby',
    description: 'Petit mur de pierre. Provocation.',
    effects: [fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')])],
  }),
  rework('Jeune Teros', 1800, 'Rocaille résistante.', {
    element: 'earth',
    lineage: 'teros',
    stage: 'young',
    description:
      'Rocaille résistante. Provocation, dégâts reçus divisés par 2.',
    effects: [
      fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')]),
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
    ],
  }),
  rework('Adulte Teros', 3000, 'La montagne vivante.', {
    element: 'earth',
    lineage: 'teros',
    stage: 'adult',
    description:
      'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses.',
    effects: [
      fx('ON_SUMMON', [
        a('SET_TAUNT', 'SELF'),
        a('SET_DEBUFF_IMMUNITY', 'SELF'),
      ]),
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
    ],
  }),
  rework('Bébé Feros', 400, 'Petite braise.', {
    element: 'fire',
    lineage: 'feros',
    stage: 'baby',
    description:
      'Petite braise. À son arrivée, inflige 100 dégâts à tous les monstres adverses.',
    effects: [
      fx('ON_SUMMON', [a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 100 })]),
    ],
  }),
  rework('Jeune Feros', 900, 'Flamme vive.', {
    element: 'fire',
    lineage: 'feros',
    stage: 'young',
    description: 'Flamme vive. Attaque Perçante.',
    effects: [fx('ON_SUMMON', [a('SET_PIERCING', 'SELF')])],
  }),
  rework('Adulte Feros', 1400, 'Incendie dévastateur.', {
    element: 'fire',
    lineage: 'feros',
    stage: 'adult',
    description:
      'Incendie dévastateur. Attaque Perçante ; à son arrivée, inflige 400 dégâts à tous les monstres adverses.',
    effects: [
      fx('ON_SUMMON', [
        a('SET_PIERCING', 'SELF'),
        a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 400 }),
      ]),
    ],
  }),
  rework('Bébé Tempestu', 500, 'Brise légère.', {
    element: 'wind',
    lineage: 'tempestu',
    stage: 'baby',
    description: 'Brise légère. Peut évoluer dès le tour où il est posé.',
    effects: [fx('PASSIVE', [a('INSTANT_EVOLUTION', 'SELF')])],
  }),
  rework('Jeune Tempestu', 1000, 'Tourbillon gênant.', {
    element: 'wind',
    lineage: 'tempestu',
    stage: 'young',
    description:
      'Tourbillon gênant. Peut évoluer dès son arrivée ; tes autres monstres peuvent évoluer sans attendre ce tour.',
    effects: [
      fx('PASSIVE', [a('INSTANT_EVOLUTION', 'SELF')]),
      fx('ON_SUMMON', [a('ALLOW_EVOLUTION_THIS_TURN', 'ALLIES_EXCEPT_SELF')]),
    ],
  }),
  rework('Adulte Tempestu', 1600, 'Ouragan de contrôle.', {
    element: 'wind',
    lineage: 'tempestu',
    stage: 'adult',
    description:
      'Ouragan de contrôle. Attaque 2 fois par tour ; à son arrivée, renvoie en main le monstre adverse le plus fort.',
    effects: [
      fx('PASSIVE', [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })]),
      fx('ON_SUMMON', [a('RETURN_TO_HAND', 'STRONGEST_ENEMY')]),
    ],
  }),
  rework('Bébé Ackos', 600, 'Goutte de vie.', {
    element: 'water',
    lineage: 'ackos',
    stage: 'baby',
    description:
      'Goutte de vie. Au début de ton tour, soigne tes autres monstres de 100 PV.',
    effects: [
      fx('ON_TURN_START', [a('HEAL', 'ALLIES_EXCEPT_SELF', { value: 100 })]),
    ],
  }),
  rework('Jeune Ackos', 1200, 'Source pure.', {
    element: 'water',
    lineage: 'ackos',
    stage: 'young',
    description:
      'Source pure. À son arrivée, récupère un Drakon de ton cimetière.',
    effects: [
      fx('ON_SUMMON', [
        a('RETURN_FROM_GRAVEYARD', 'PLAYER', {
          value: 1,
          filter: { archetype: 'dragon' },
        }),
      ]),
    ],
  }),
  rework('Adulte Ackos', 2200, 'Océan de soin.', {
    element: 'water',
    lineage: 'ackos',
    stage: 'adult',
    description:
      'Océan de soin. Au début de ton tour, soigne tes autres monstres de 300 PV ; à son arrivée, récupère 2 cartes de ton cimetière.',
    effects: [
      fx('ON_TURN_START', [a('HEAL', 'ALLIES_EXCEPT_SELF', { value: 300 })]),
      fx('ON_SUMMON', [a('RETURN_FROM_GRAVEYARD', 'PLAYER', { value: 2 })]),
    ],
  }),
  rework('Incubation Rapide', 0, "Accélère l'éclosion.", {
    description:
      "Accélère l'éclosion d'un de tes Œufs de 2 tours, ou permet à un de tes Drakons d'évoluer ce tour.",
    effects: [
      fx('ON_PLAY', [
        a('ADVANCE_HATCH', 'TARGET_ALLY', { value: 2 }),
        a('ALLOW_EVOLUTION_THIS_TURN', 'TARGET_ALLY'),
      ]),
    ],
  }),
  rework('Ecaille de Dragon', 400, 'Protection naturelle.', {
    name: 'Écaille de Dragon',
    description:
      'Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux effets adverses.',
    effects: [
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
      fx('PASSIVE', [a('SET_DEBUFF_IMMUNITY', 'SELF')], {
        type: 'EQUIPPED_ON',
        stage: 'egg',
      }),
    ],
  }),
  rework('Bouclier de Fortune', 0, 'Protection de fortune.', {
    description:
      "Un de tes monstres est insensible aux dégâts de combat jusqu'à ton prochain tour.",
    effects: [fx('ON_PLAY', [a('SET_COMBAT_IMMUNITY', 'TARGET_ALLY')])],
  }),
  rework('Potion de Lucidité', 0, 'Simple et efficace.', {
    description: 'Cherche un Drakon ou un Œuf dans ton deck.',
    effects: [
      fx('ON_PLAY', [
        a('SEARCH_DECK', 'PLAYER', { filter: { archetype: 'dragon' } }),
      ]),
    ],
  }),
  rework('Souffle Primordial', 0, 'Puissance élémentaire.', {
    description:
      'Tes Drakons gagnent +300 ATK ce tour, +600 si tu contrôles un Drakon Adulte.',
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
  }),
  rework('Frappe Préventive', 0, 'Premier coup.', {
    description:
      'Inflige 300 dégâts à un monstre adverse, 600 si tu contrôles un Drakon de Feu.',
    effects: [
      fx('ON_PLAY', [
        a('DEAL_DAMAGE', 'ENEMY_MONSTER', {
          value: 300,
          valueIf: {
            condition: { type: 'DRAKON_ON_BOARD', element: 'fire' },
            value: 600,
          },
        }),
      ]),
    ],
  }),
];

export const DRAKON_NEW_CARDS: DrakonNewCard[] = [
  {
    name: 'Œuf de la Dualité',
    rarity: 'epic',
    cost: 1,
    hp: 300,
    description:
      "Deux destins dans une coquille. S'il est détruit, un Jeune Drakon de ton choix surgit ; s'il survit 2 tours, il éclot en Bébé Drakon.",
    effects: [
      fx('ON_SUMMON', [
        a('SET_HATCH_COUNTER', 'SELF', { value: 2, filter: { stage: 'baby' } }),
      ]),
      fx('ON_DEATH', [
        a('SUMMON_FROM_DECK', 'PLAYER', { filter: { stage: 'young' } }),
      ]),
    ],
  },
  {
    name: 'Œuf Céleste',
    rarity: 'legendary',
    cost: 2,
    hp: 600,
    description:
      'Couvé par les étoiles. Après 4 tours, il éclot directement en Drakon Adulte de ton choix. À protéger à tout prix.',
    effects: [
      fx('ON_SUMMON', [
        a('SET_HATCH_COUNTER', 'SELF', {
          value: 4,
          filter: { stage: 'adult' },
        }),
      ]),
    ],
  },
];

function fingerprint(f: {
  name: string;
  description: string | null;
  hp: number;
  effects: unknown;
  element: string | null;
  lineage: string | null;
  stage: string | null;
}): string {
  return JSON.stringify([
    f.name,
    f.description ?? null,
    Number(f.hp),
    canonicalEffects(f.effects ?? null),
    f.element ?? null,
    f.lineage ?? null,
    f.stage ?? null,
  ]);
}

/** Même garde que planCardRework, champs Drakon inclus. */
export function planDrakonPatch(
  current: Parameters<typeof fingerprint>[0] | undefined,
  patch: DrakonPatch,
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
