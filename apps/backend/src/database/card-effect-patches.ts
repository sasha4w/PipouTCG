import type { CardEffect } from '@pipou/shared';

/** Effets d'une carte avant/après la généralisation des cartes codées en dur. */
export interface CardEffectPatch {
  cardId: number;
  cardName: string;
  before: CardEffect[];
  after: CardEffect[];
}

const onBoard = (value: string) =>
  ({ type: 'SPECIFIC_CARD_ON_BOARD', value }) as const;
const equippedOn = (value: string) => ({ type: 'EQUIPPED_ON', value }) as const;

/** Partagé par la migration GenericCardEffects et les tests de vraies cartes. */
export const CARD_EFFECT_PATCHES: CardEffectPatch[] = [
  {
    cardId: 9,
    cardName: 'Commandant Quenouille',
    before: [
      {
        actions: [{ type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [
          { type: 'CANNOT_ATTACK_ON_SUMMON_TURN', target: 'SELF' },
          { type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' },
        ],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
  },
  {
    cardId: 17,
    cardName: "Clairon de l'Union",
    before: [
      {
        actions: [{ type: 'GAIN_RECYCLE_ENERGY', value: 2, target: 'PLAYER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'GAIN_RECYCLE_ENERGY', value: 2, target: 'PLAYER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
      {
        actions: [{ type: 'DRAW', value: 1, target: 'PLAYER' }],
        trigger: 'ON_RECYCLE',
        condition: null,
      },
    ],
  },
  {
    cardId: 97,
    cardName: 'Canon à Particules .vxd',
    before: [
      {
        actions: [{ type: 'BUFF_ATK', value: 400, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
      {
        actions: [{ type: 'SET_PIERCING', value: 1, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'BUFF_ATK', value: 400, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
      {
        actions: [{ type: 'SET_PIERCING', value: 1, target: 'SELF' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
  },
  {
    cardId: 99,
    cardName: 'Rootkit de Transmission',
    before: [
      {
        actions: [{ type: 'FORCE_ATTACK_MODE_ENEMY', target: 'ALL_ENEMIES' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'FORCE_ATTACK_MODE_ENEMY', target: 'ENEMY_MONSTER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
  },
  {
    cardId: 122,
    cardName: 'Noyau Zeta',
    before: [
      {
        actions: [{ type: 'SET_TURN_COUNTER', value: 3, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'SET_TURN_COUNTER', value: 3, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
      {
        actions: [{ type: 'SUMMONABLE_ON_ENEMY_SIDE', target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
    ],
  },
  {
    cardId: 127,
    cardName: "Module d'Extension .v2",
    before: [
      {
        actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Alpha'),
      },
      {
        actions: [{ type: 'DEAL_DAMAGE', value: 400, target: 'ALL_ENEMIES' }],
        trigger: 'ON_TURN_START',
        condition: onBoard('Noyau Beta'),
      },
      {
        actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Delta'),
      },
    ],
    after: [
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
  {
    cardId: 128,
    cardName: 'Firewall de Surcharge .sys',
    before: [
      {
        actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Alpha'),
      },
      {
        actions: [{ type: 'HEAL', value: 300, target: 'SELF' }],
        trigger: 'ON_TURN_START',
        condition: onBoard('Noyau Beta'),
      },
      {
        actions: [{ type: 'SET_DELAY_DOUBLE_ATK', target: 'SELF' }],
        trigger: 'ON_PLAY',
        condition: onBoard('Noyau Delta'),
      },
    ],
    after: [
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
];

/** JSON stable (clés d'objets triées) pour comparer deux listes d'effets. */
export function canonicalEffects(value: unknown): string {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return JSON.stringify(parsed, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
}

export type PatchDecision = 'apply' | 'already-done' | 'skip-diverged';

/** Que faire d'une carte selon ses effets actuels (JSON brut ou déjà parsé). */
export function planPatch(
  current: unknown,
  from: CardEffect[],
  to: CardEffect[],
): PatchDecision {
  if (current === null || current === undefined) return 'skip-diverged';
  const actual = canonicalEffects(current);
  if (actual === canonicalEffects(to)) return 'already-done';
  if (actual === canonicalEffects(from)) return 'apply';
  return 'skip-diverged';
}
