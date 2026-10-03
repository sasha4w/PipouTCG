import { CardType, Rarity, SupportType } from '@pipou/shared';
import type {
  ActionType,
  CardEffect,
  EffectAction,
  EffectCondition,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { Card } from '../../cards/card.entity';

let nextCardId = 10_000;

type CardOverrides = Partial<Card>;

function baseCard(overrides: CardOverrides): Card {
  return {
    id: nextCardId++,
    name: 'Carte test',
    rarity: Rarity.COMMON,
    type: CardType.MONSTER,
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: null,
    archetype: null,
    effects: null,
    description: '',
    image: null,
    ...overrides,
  } as Card;
}

/** Monstre de test : 100 ATK / 500 PV, coût 0, sans effet par défaut. */
export function monsterCard(name: string, overrides: CardOverrides = {}): Card {
  return baseCard({
    name,
    type: CardType.MONSTER,
    atk: 100,
    hp: 500,
    ...overrides,
  });
}

function supportCard(
  name: string,
  supportType: SupportType,
  effects: CardEffect[],
  overrides: CardOverrides,
): Card {
  return baseCard({
    name,
    type: CardType.SUPPORT,
    supportType,
    effects,
    ...overrides,
  });
}

export const ephemeralCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.EPHEMERAL, effects, overrides);

export const equipmentCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.EQUIPMENT, effects, overrides);

export const terrainCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.TERRAIN, effects, overrides);

/** Carte sans effet, pour remplir decks et Primes. */
export function fillerCard(name = 'Remplissage'): Card {
  return monsterCard(name, { atk: 0, hp: 100 });
}

export function effect(
  trigger: EffectTrigger,
  actions: EffectAction[],
  condition: EffectCondition | null = null,
): CardEffect {
  return { trigger, condition, actions };
}

export function act(
  type: ActionType,
  target: EffectTarget,
  extra: Partial<EffectAction> = {},
): EffectAction {
  return { type, target, ...extra };
}
