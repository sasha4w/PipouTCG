import type { EffectFilter } from '@pipou/shared';
import { a, fx } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';

/**
 * Patch 2026-11 : Pixel Ghost et Drone Éclaireur ne cherchent plus un Noyau (Sentinelle
 * le garde) : monstre Pixelman pour l'un, support Pixelman pour l'autre.
 */

const searchOnDeath = (filter: EffectFilter) => [
  fx('ON_DEATH', [a('SEARCH_DECK', 'PLAYER', { filter })]),
];

const NOYAU = searchOnDeath({ name: 'Noyau', archetype: 'pixelman' });

const card = (
  name: string,
  atk: number,
  hp: number,
  beforeText: string,
  afterText: string,
  filter: EffectFilter,
): BalancePatch => ({
  before: { name, description: beforeText, atk, hp, cost: 1, effects: NOYAU },
  after: {
    name,
    description: afterText,
    atk,
    hp,
    cost: 1,
    effects: searchOnDeath(filter),
  },
});

export const PIXELMAN_RECHERCHE_PATCHES: BalancePatch[] = [
  card(
    'Pixel Ghost .tmp',
    200,
    600,
    "Fragment résiduel. À sa destruction, cherche un Noyau Pixelman dans votre deck et l'ajoute en main.",
    "Fragment résiduel. À sa destruction, cherche un monstre Pixelman dans votre deck et l'ajoute en main.",
    { type: 'monster', archetype: 'pixelman' },
  ),
  card(
    'Drone Éclaireur .log',
    300,
    500,
    "Unité sacrificielle. À sa destruction, cherche un Noyau Pixelman dans votre deck et l'ajoute en main.",
    "Unité sacrificielle. À sa destruction, cherche un support Pixelman dans votre deck et l'ajoute en main.",
    { type: 'support', archetype: 'pixelman' },
  ),
];
