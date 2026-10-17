import type { CardEffect } from '@pipou/shared';
import { canonicalEffects, type PatchDecision } from './card-effect-patches';

/** Champs d'une carte touchés par le retravail. */
export interface CardFields {
  name: string;
  description: string | null;
  effects: CardEffect[] | null;
}

/** État attendu en prod (export du 2026-10-17) → nouvel état. */
export interface CardReworkPatch {
  before: CardFields;
  after: CardFields;
}

const onBoard = (value: string) =>
  ({ type: 'SPECIFIC_CARD_ON_BOARD', value }) as const;
const equippedOn = (value: string) => ({ type: 'EQUIPPED_ON', value }) as const;

const withDescription = (
  fields: CardFields,
  description: string,
): CardReworkPatch => ({ before: fields, after: { ...fields, description } });

const QUENOUILLE_EFFECTS: CardEffect[] = [
  {
    actions: [
      { type: 'CANNOT_ATTACK_ON_SUMMON_TURN', target: 'SELF' },
      { type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' },
    ],
    trigger: 'ON_SUMMON',
    condition: null,
  },
];

export const CARD_REWORK_PATCHES: CardReworkPatch[] = [
  withDescription(
    {
      name: 'Capitaine Gribouille',
      description:
        "Leader de le Brigade Ouille reconnu pour c'est attention noble de protèger son prochain.",
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
    'Leader de la Brigade Ouille, reconnu pour sa noble manie de protéger son prochain.',
  ),
  withDescription(
    {
      name: 'Lieutenant Fripouille',
      description:
        'Rival de Bidouille leur entrée dans la pipoSquad ils sont comme chienn et chat',
      effects: [
        {
          actions: [
            { type: 'BUFF_ATK', value: 150, target: 'SELF' },
            { type: 'BUFF_HP', value: 150, target: 'SELF' },
          ],
          trigger: 'PASSIVE',
          condition: onBoard('Lieutenant Bidouille'),
        },
      ],
    },
    'Rival de Bidouille depuis leur entrée dans la PipouSquad : ils sont comme chien et chat.',
  ),
  withDescription(
    {
      name: 'Commandant Quenouille',
      description:
        'Paresseux, à son poste malgré lui mais jamais en avance et jamais en retard. Si on en vraiment besoin il vient.',
      effects: QUENOUILLE_EFFECTS,
    },
    'Paresseux, à son poste malgré lui : jamais en avance, jamais en retard. Si on a vraiment besoin de lui, il vient.',
  ),
  withDescription(
    {
      name: 'Maître Magouille',
      description:
        "Membre fondateur de la PipouSquad, ne se présente qu'à de rares occasions.",
      effects: [
        {
          actions: [{ type: 'SET_DEBUFF_IMMUNITY', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
    "Membre fondateur de la PipouSquad, ne se présente qu'en de rares occasions. Insensible aux effets des cartes adverses.",
  ),
  withDescription(
    {
      name: 'Médecin Citrouille',
      description:
        'Un peu fou sur les bords, il sait exploiter le maximum du potentiel de la médecine végétale ',
      effects: [
        {
          actions: [{ type: 'HEAL', value: 200, target: 'ALLIES_EXCEPT_SELF' }],
          trigger: 'ON_TURN_START',
          condition: null,
        },
      ],
    },
    'Un peu fou sur les bords, il sait exploiter tout le potentiel de la médecine végétale.',
  ),
  withDescription(
    {
      name: "Soin d'urgence",
      description:
        'Soin de 30% des points de vie max ou 60% si un pipouman médecin est sur le terrain',
      effects: [
        {
          actions: [{ type: 'HEAL', value: 600, target: 'TARGET_ALLY' }],
          trigger: 'ON_PLAY',
          condition: null,
        },
        {
          actions: [{ type: 'HEAL', value: 200, target: 'TARGET_ALLY' }],
          trigger: 'ON_PLAY',
          condition: onBoard('Médecin Citrouille'),
        },
      ],
    },
    'Soigne un de vos monstres de 600 PV, ou de 800 PV si Médecin Citrouille est sur le terrain.',
  ),
  {
    before: {
      name: 'Ouille au rapport',
      description:
        "Permet de récupérer un ouille commun ou non commun. Si Capitaine présent sur le terrain il peut l'invoquer sans utilisé de cost",
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD',
              value: 3,
              filter: { rarities: ['common', 'uncommon'], archetype: 'pipou' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_PLAY',
          condition: null,
        },
      ],
    },
    after: {
      name: 'Ouille au rapport',
      description:
        "Récupère jusqu'à 2 Ouilles communs ou peu communs de votre cimetière, ou 3 si un Capitaine est sur le terrain.",
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD',
              value: 2,
              filter: { rarities: ['common', 'uncommon'], archetype: 'pipou' },
              target: 'PLAYER',
              valueIf: {
                condition: {
                  type: 'SPECIFIC_CARD_ON_BOARD',
                  value: 'Capitaine',
                  match: 'contains',
                },
                value: 3,
              },
            },
          ],
          trigger: 'ON_PLAY',
          condition: null,
        },
      ],
    },
  },
  withDescription(
    {
      name: 'Vice Capitaine Patouille',
      description: null,
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD_OR_DECK',
              value: 1,
              filter: { name: 'Capitaine Gribouille' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_DEATH',
          condition: null,
        },
      ],
    },
    'Fidèle second du Capitaine. À sa destruction, récupère Capitaine Gribouille depuis votre cimetière ou votre deck.',
  ),
  withDescription(
    {
      name: 'Tactique Gang Gang',
      description: '',
      effects: [
        {
          actions: [{ type: 'BUFF_ATK', value: 300, target: 'ALL_ALLIES' }],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
    'La stratégie de groupe signée Ouille. Tous vos monstres gagnent +300 ATK.',
  ),
  {
    before: {
      name: 'Recrue Andouille',
      description:
        'Tête brulée de la brigade Ouille, semble plus préoccupé par son allure et que sa santé.',
      effects: null,
    },
    after: {
      name: 'Recrue Andouille',
      description:
        'Tête brûlée de la Brigade Ouille, plus préoccupé par son allure que par sa santé. Toujours en mode Attaque, +200 ATK au début de chaque phase de combat.',
      effects: [
        {
          actions: [{ type: 'FORCE_ATTACK_MODE', target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
        {
          actions: [{ type: 'BUFF_ATK_TEMP', value: 200, target: 'SELF' }],
          trigger: 'ON_BATTLE_PHASE_START',
          condition: null,
        },
      ],
    },
  },
  {
    before: {
      name: 'Éclaireur Nouille',
      description:
        "Son esprit de curiosité la pousser à s'engager dans la Brigade Ouille.",
      effects: null,
    },
    after: {
      name: 'Éclaireur Nouille',
      description:
        "Sa curiosité l'a poussé à s'engager dans la Brigade Ouille. À son arrivée, pioche une carte.",
      effects: [
        {
          actions: [{ type: 'DRAW', value: 1, target: 'PLAYER' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: { name: 'Guerrier Bafouille', description: null, effects: null },
    after: {
      name: 'Guerrier Bafouille',
      description:
        'Fonce dans la mêlée sans réfléchir. +100 ATK quand il attaque.',
      effects: [
        {
          actions: [{ type: 'BUFF_ATK_TEMP', value: 100, target: 'SELF' }],
          trigger: 'ON_ATTACK',
          condition: null,
        },
      ],
    },
  },
  {
    before: { name: 'Canouille le Bleu', description: null, effects: null },
    after: {
      name: 'Canouille le Bleu',
      description:
        "L'artilleur de la brigade. À son arrivée, inflige 100 dégâts à tous les monstres adverses.",
      effects: [
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 100, target: 'ALL_ENEMIES' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: {
      name: 'Sentinelle Gargouille',
      description: null,
      effects: null,
    },
    after: {
      name: 'Sentinelle Gargouille',
      description: 'Veille sur la brigade sans jamais ciller. Provocation.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: {
      name: 'Caporal Gazouille',
      description: 'Expert en communication de la brigade.',
      effects: null,
    },
    after: {
      name: 'Caporal Gazouille',
      description:
        'Expert en communication de la brigade. Donne +100 ATK aux alliés adjacents.',
      effects: [
        {
          actions: [
            { type: 'BUFF_ATK', value: 100, target: 'ADJACENT_ALLIES' },
          ],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
  },
  withDescription(
    {
      name: 'Noyau Omega',
      description:
        'Le cerveau du réseau. Booste en permanence tous les Noyaux alliés.',
      effects: [
        {
          actions: [
            { type: 'BUFF_ATK', value: 300, target: 'ARCHETYPE_ALLIES' },
            { type: 'BUFF_HP', value: 300, target: 'ARCHETYPE_ALLIES' },
          ],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
    'Le cerveau du réseau. Donne en permanence +300 ATK et +300 PV à tous les Pixelman alliés.',
  ),
  {
    before: {
      name: "Module d'Extension .v2",
      description:
        'Sur Alpha : Provocation. Sur Beta : Burn +400 sur tous les ennemis/tour. Sur Delta : +600 ATK.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 400, target: 'ALL_ENEMIES' }],
          trigger: 'ON_TURN_START',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
    after: {
      name: 'Module Bluetooth .v2',
      description:
        'Sur Alpha : attaque 2 fois par tour. Sur Beta : à l’équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK.',
      effects: [
        {
          actions: [{ type: 'SET_ATTACKS_PER_TURN', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 600, target: 'ALL_ENEMIES' }],
          trigger: 'ON_PLAY',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
  },
  {
    before: {
      name: 'Firewall de Surcharge .sys',
      description:
        'Sur Alpha : Réduction dégâts ×2. Sur Beta : +300 HP/tour. Sur Delta : Double attaque.',
      effects: [
        {
          actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'HEAL', value: 300, target: 'SELF' }],
          trigger: 'ON_TURN_START',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'SET_ATTACKS_PER_TURN', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
    after: {
      name: 'Firewall de Surcharge .sys',
      description:
        'Sur Alpha : à l’équipement, insensible aux dégâts de combat jusqu’à votre prochain tour. Sur Beta : ne peut pas être détruit par une carte Support. Sur Delta : ignore la Provocation.',
      effects: [
        {
          actions: [{ type: 'SET_COMBAT_IMMUNITY', target: 'SELF' }],
          trigger: 'ON_PLAY',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'SET_SUPPORT_DESTROY_IMMUNITY', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'IGNORE_TAUNT', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
  },
  (() => {
    const alpha: CardFields = {
      name: 'Noyau Alpha ',
      description:
        'Noyau de défense absolu. Provocation permanente, encaisse tout en mode Garde.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
        {
          actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    };
    return { before: alpha, after: { ...alpha, name: 'Noyau Alpha' } };
  })(),
  (() => {
    const sorcier: CardFields = {
      name: 'Sorcier Ratatouille ',
      description: "Pluie d'encre.",
      effects: [
        {
          actions: [
            {
              type: 'SEARCH_DECK',
              value: 1,
              filter: { type: 'support', archetype: 'pipou' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    };
    return {
      before: sorcier,
      after: { ...sorcier, name: 'Sorcier Ratatouille' },
    };
  })(),
];

/** Empreinte comparable d'une carte (clés triées, effets JSON brut ou parsé). */
function fingerprint(fields: {
  name: string;
  description: string | null;
  effects: unknown;
}): string {
  return JSON.stringify([
    fields.name,
    fields.description ?? null,
    canonicalEffects(fields.effects ?? null),
  ]);
}

/**
 * Que faire d'une carte (retrouvée par nom) selon son état actuel.
 * `up` : before → after ; `down` : after → before.
 */
export function planCardRework(
  current:
    { name: string; description: string | null; effects: unknown } | undefined,
  patch: CardReworkPatch,
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
