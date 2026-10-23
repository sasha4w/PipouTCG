import type {
  CardEffect,
  DrakonElement,
  DrakonStage,
  Rarity,
} from '@pipou/shared';
import { a, fx } from './balance-2026-10-patches';

/** Nouvelle carte Drakon (stade, élément, lignée), créée sans image. */
export interface DrakonNewCard {
  name: string;
  rarity: Rarity;
  stage: DrakonStage | null;
  element: DrakonElement | null;
  lineage: string | null;
  /** Nom d'une carte du set visé : la nouvelle carte rejoint son set. */
  setOf: string;
  atk: number;
  hp: number;
  cost: number;
  description: string;
  effects: CardEffect[];
}

const ancestral = (
  name: string,
  element: DrakonElement,
  lineage: string,
  atk: number,
  hp: number,
  description: string,
  effects: CardEffect[],
): DrakonNewCard => ({
  name,
  rarity: 'legendary',
  stage: 'ancestral',
  element,
  lineage,
  setOf: 'Bébé Teros',
  atk,
  hp,
  cost: 4,
  description,
  effects,
});

/**
 * Extension Drakon du patch « Garde, Relève et Origines » (design 2026-10-23,
 * section 5). Valeurs : environ +30 % sur l'Adulte, à régler au tournoi.
 */
export const DRAKON_ORIGINES_CARDS: DrakonNewCard[] = [
  ancestral(
    'Ancestral Teros',
    'earth',
    'teros',
    800,
    3900,
    "Le socle du monde. Évolue d'Adulte Teros. Provocation, insensible aux effets adverses, dégâts reçus divisés par 2, renvoie 60 % des dégâts reçus. Détruit : vous piochez 1 carte.",
    [
      fx('ON_SUMMON', [
        a('SET_TAUNT', 'SELF'),
        a('SET_DEBUFF_IMMUNITY', 'SELF'),
      ]),
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
      fx('PASSIVE', [a('REFLECT_DAMAGE', 'SELF', { value: 60 })]),
      fx('ON_DEATH', [a('DRAW', 'PLAYER', { value: 1 })]),
    ],
  ),
  ancestral(
    'Ancestral Feros',
    'fire',
    'feros',
    2100,
    1800,
    "Le premier brasier. Évolue d'Adulte Feros. Attaque Perçante ; à son arrivée, inflige 600 dégâts à tous les monstres adverses.",
    [
      fx('ON_SUMMON', [
        a('SET_PIERCING', 'SELF'),
        a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 600 }),
      ]),
    ],
  ),
  ancestral(
    'Ancestral Ackos',
    'water',
    'ackos',
    1000,
    2900,
    "La source éternelle. Évolue d'Adulte Ackos. Au début de chacun de tes tours, soigne tes autres monstres de 500 PV ; à son arrivée, récupère 2 cartes de ton cimetière.",
    [
      fx('ON_TURN_START', [a('HEAL', 'ALLIES_EXCEPT_SELF', { value: 500 })]),
      fx('ON_SUMMON', [a('RETURN_FROM_GRAVEYARD', 'PLAYER', { value: 2 })]),
    ],
  ),
  ancestral(
    'Ancestral Tempestu',
    'wind',
    'tempestu',
    1300,
    2100,
    "L'ouragan originel. Évolue d'Adulte Tempestu. Attaque deux fois par tour ; à son arrivée, renvoie en main le monstre adverse le plus fort.",
    [
      fx('PASSIVE', [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })]),
      fx('ON_SUMMON', [a('RETURN_TO_HAND', 'STRONGEST_ENEMY')]),
    ],
  ),
  {
    name: 'Drakon des Origines',
    rarity: 'secret',
    stage: null,
    element: null,
    lineage: null,
    setOf: 'Bébé Teros',
    atk: 1500,
    hp: 4000,
    cost: 4,
    description:
      "L'aube de tous les Drakons. Invocable seulement avec un Adulte ou un Ancestral de chaque élément dans ton cimetière. Insensible aux effets adverses ; à son arrivée, copie le pouvoir de l'un d'eux.",
    effects: [
      fx('PASSIVE', [a('SUMMON_IF_ALL_ELEMENTS', 'SELF')]),
      fx('ON_SUMMON', [a('SET_DEBUFF_IMMUNITY', 'SELF', { value: 1 })]),
      fx('ON_SUMMON', [a('COPY_GRAVEYARD_EFFECTS', 'PLAYER')]),
    ],
  },
];
