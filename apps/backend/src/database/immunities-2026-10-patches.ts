import type { CardEffect, EffectAction } from '@pipou/shared';
import type { CardEffectPatch } from './card-effect-patches';

/**
 * Immunités différenciées : l'ancienne « insensible aux effets adverses »
 * (SET_DEBUFF_IMMUNITY) est remplacée, carte par carte, par les immunités
 * voulues. `before` reflète la prod au 30/10/2026.
 */
export interface ImmunityPatch extends CardEffectPatch {
  descriptionBefore: string;
  descriptionAfter: string;
}

const self = (type: string, value?: number): EffectAction =>
  (value === undefined
    ? { type, target: 'SELF' }
    : { type, value, target: 'SELF' }) as EffectAction;

const SUPPORT_DEBUFF = 'SET_SUPPORT_DEBUFF_IMMUNITY';
const MONSTER_DEBUFF = 'SET_MONSTER_DEBUFF_IMMUNITY';
const SUPPORT_DESTROY = 'SET_SUPPORT_DESTROY_IMMUNITY';
const MONSTER_STATUS = 'SET_MONSTER_STATUS_IMMUNITY';

const ALL_EFFECT_IMMUNITIES = [
  SUPPORT_DESTROY,
  SUPPORT_DEBUFF,
  MONSTER_DEBUFF,
  MONSTER_STATUS,
];

/** Remplace l'unique SET_DEBUFF_IMMUNITY des effets par les actions données. */
function replaceLegacy(
  before: CardEffect[],
  types: string[],
  value?: number,
): CardEffect[] {
  return before.map((e) => ({
    ...e,
    actions: e.actions.flatMap((a) =>
      a.type === 'SET_DEBUFF_IMMUNITY' ? types.map((t) => self(t, value)) : [a],
    ),
  }));
}

const fx = (
  trigger: string,
  actions: EffectAction[],
  condition: unknown = null,
): CardEffect => ({ actions, trigger, condition }) as CardEffect;

const teros = (reflect: number): CardEffect[] => [
  fx('ON_SUMMON', [self('SET_TAUNT'), self('SET_DEBUFF_IMMUNITY')]),
  fx('PASSIVE', [self('SET_DAMAGE_REDUCTION', 2)]),
  fx('PASSIVE', [self('REFLECT_DAMAGE', reflect)]),
  fx('ON_DEATH', [{ type: 'DRAW', value: 1, target: 'PLAYER' }]),
];

const MAGOUILLE: CardEffect[] = [
  fx('ON_SUMMON', [self('SET_DEBUFF_IMMUNITY', 1)]),
];
const ECAILLE: CardEffect[] = [
  fx('PASSIVE', [self('SET_DAMAGE_REDUCTION', 2)]),
  fx('PASSIVE', [self('SET_DEBUFF_IMMUNITY')], {
    type: 'EQUIPPED_ON',
    stage: 'egg',
  }),
];
const DRAKON_ORIGINES: CardEffect[] = [
  fx('PASSIVE', [self('SUMMON_IF_ALL_ELEMENTS')]),
  fx('ON_SUMMON', [self('SET_DEBUFF_IMMUNITY', 1)]),
  fx('ON_SUMMON', [{ type: 'COPY_GRAVEYARD_EFFECTS', target: 'PLAYER' }]),
];

export const IMMUNITY_PATCHES: ImmunityPatch[] = [
  {
    cardId: 10,
    cardName: 'Maître Magouille',
    before: MAGOUILLE,
    after: replaceLegacy(MAGOUILLE, ALL_EFFECT_IMMUNITIES, 1),
    descriptionBefore:
      "Membre fondateur de la PipouSquad, ne se présente qu'en de rares occasions. Insensible aux effets des cartes adverses.",
    descriptionAfter:
      "Membre fondateur de la PipouSquad, ne se présente qu'en de rares occasions. Insensible à tous les effets adverses, mais destructible en combat.",
  },
  {
    cardId: 105,
    cardName: 'Adulte Teros',
    before: teros(50),
    after: replaceLegacy(teros(50), [SUPPORT_DEBUFF, MONSTER_DEBUFF]),
    descriptionBefore:
      'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses, renvoie 50 % des dégâts reçus. Détruit : vous piochez 1 carte.',
    descriptionAfter:
      'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux malus adverses, renvoie 50 % des dégâts reçus. Détruit : vous piochez 1 carte.',
  },
  {
    cardId: 116,
    cardName: 'Écaille de Dragon',
    before: ECAILLE,
    after: replaceLegacy(ECAILLE, [SUPPORT_DEBUFF, MONSTER_DEBUFF]),
    descriptionBefore:
      'Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux effets adverses.',
    descriptionAfter:
      'Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux malus adverses.',
  },
  {
    cardId: 141,
    cardName: 'Ancestral Teros',
    before: teros(60),
    after: replaceLegacy(teros(60), [
      SUPPORT_DEBUFF,
      MONSTER_DEBUFF,
      SUPPORT_DESTROY,
    ]),
    descriptionBefore:
      "Le socle du monde. Évolue d'Adulte Teros. Provocation, insensible aux effets adverses, dégâts reçus divisés par 2, renvoie 60 % des dégâts reçus. Détruit : vous piochez 1 carte.",
    descriptionAfter:
      "Le socle du monde. Évolue d'Adulte Teros. Provocation, insensible aux malus adverses et à la destruction par Support, dégâts reçus divisés par 2, renvoie 60 % des dégâts reçus. Détruit : vous piochez 1 carte.",
  },
  {
    cardId: 145,
    cardName: 'Drakon des Origines',
    before: DRAKON_ORIGINES,
    after: replaceLegacy(DRAKON_ORIGINES, ALL_EFFECT_IMMUNITIES, 1),
    descriptionBefore:
      "L'aube de tous les Drakons. Invocable seulement avec un Adulte ou un Ancestral de chaque élément dans ton cimetière. Insensible aux effets adverses ; à son arrivée, copie le pouvoir de l'un d'eux.",
    descriptionAfter:
      "L'aube de tous les Drakons. Invocable seulement avec un Adulte ou un Ancestral de chaque élément dans ton cimetière. Insensible à tous les effets adverses ; à son arrivée, copie le pouvoir de l'un d'eux.",
  },
];
