import type { CardEffect } from '@pipou/shared';
import { a, BALANCE_PATCHES, fx } from './balance-2026-10-patches';
import type { BalanceFields, BalancePatch } from './balance-2026-10-patches';
import { DRAKON_ORIGINES_CARDS } from './drakon-origines-cards';
import { GARDE_PATCHES } from './garde-2026-10-patches';
import { IMMUNITY_PATCHES } from './immunities-2026-10-patches';

/**
 * Nerf des Teros et de l'Écaille de Dragon (2026-10-31) : moins de PV, et les
 * dégâts divisés par 2 ne durent plus que 2 tours du propriétaire (décomptés à
 * chaque début de tour, à partir de l'invocation ou de la pose).
 */

const REDUCTION_TURNS = 2;

const gardeAfter = (name: string): BalanceFields => {
  const patch = GARDE_PATCHES.find((p) => p.after.name === name);
  if (!patch) throw new Error(`Patch Garde « ${name} » introuvable`);
  return patch.after;
};

/** Description et effets après le patch d'immunités, pour la carte d'id donné. */
const immunityAfter = (cardId: number) => {
  const patch = IMMUNITY_PATCHES.find((p) => p.cardId === cardId);
  if (!patch) throw new Error(`Patch d'immunités #${cardId} introuvable`);
  return { description: patch.descriptionAfter, effects: patch.after };
};

const isReduction = (e: CardEffect) =>
  e.actions.some((x) => x.type === 'SET_DAMAGE_REDUCTION');

/** La réduction passive devient un effet posé à l'invocation / à la pose, limité dans le temps. */
const timedReduction = (
  effects: CardEffect[],
  trigger: CardEffect['trigger'],
): CardEffect[] => [
  ...effects.filter((e) => !isReduction(e)),
  fx(trigger, [
    a('SET_DAMAGE_REDUCTION', 'SELF', {
      value: 2,
      duration: REDUCTION_TURNS,
    }),
  ]),
];

const withDuration = (description: string | null): string =>
  (description ?? '').replace(
    'divisés par 2',
    `divisés par 2 pendant ${REDUCTION_TURNS} tours`,
  );

const BEBE_TEROS = gardeAfter('Bébé Teros');
const JEUNE_TEROS = gardeAfter('Jeune Teros');
const ADULTE_TEROS: BalanceFields = {
  ...gardeAfter('Adulte Teros'),
  ...immunityAfter(105),
};
const ANCESTRAL_TEROS: BalanceFields = (() => {
  const card = DRAKON_ORIGINES_CARDS.find((c) => c.name === 'Ancestral Teros');
  if (!card) throw new Error('Ancestral Teros introuvable');
  return {
    name: card.name,
    atk: card.atk,
    hp: card.hp,
    cost: card.cost,
    ...immunityAfter(141),
  };
})();
const ECAILLE: BalanceFields = (() => {
  const patch = BALANCE_PATCHES.find(
    (p) => p.after.name === 'Écaille de Dragon',
  );
  if (!patch) throw new Error('Écaille de Dragon introuvable');
  return { ...patch.after, ...immunityAfter(116) };
})();

export const TEROS_PATCHES: BalancePatch[] = [
  { before: BEBE_TEROS, after: { ...BEBE_TEROS, hp: 1000 } },
  {
    before: JEUNE_TEROS,
    after: {
      ...JEUNE_TEROS,
      hp: 1400,
      description: withDuration(JEUNE_TEROS.description),
      effects: timedReduction(JEUNE_TEROS.effects ?? [], 'ON_SUMMON'),
    },
  },
  {
    before: ADULTE_TEROS,
    after: {
      ...ADULTE_TEROS,
      hp: 2200,
      description: withDuration(ADULTE_TEROS.description),
      effects: timedReduction(ADULTE_TEROS.effects ?? [], 'ON_SUMMON'),
    },
  },
  {
    before: ANCESTRAL_TEROS,
    after: {
      ...ANCESTRAL_TEROS,
      hp: 2900,
      description: withDuration(ANCESTRAL_TEROS.description),
      effects: timedReduction(ANCESTRAL_TEROS.effects ?? [], 'ON_SUMMON'),
    },
  },
  {
    before: ECAILLE,
    after: {
      ...ECAILLE,
      description: withDuration(ECAILLE.description),
      effects: timedReduction(ECAILLE.effects ?? [], 'ON_PLAY'),
    },
  },
];
