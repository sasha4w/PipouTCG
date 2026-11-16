import { Rarity } from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { findByName } from './deck-generator';
import { BOSS_SECRET_CARD, type Signature } from './signatures';

/** Taux de la carte précise : Ancestral d'un niveau d'élément, carte secrète du boss (Drakon des Origines…). */
export const ANCESTRAL_FARM_PCT = 5;
export const ORIGINES_FARM_PCT = 1;

/**
 * Carte précise qui tombe en farm contre l'IA de `signature` au `level` :
 * l'Ancestral de son élément, ou, pour le boss de niveau 5, la carte
 * secrète de son archétype (sinon sa signature, si elle est secrète).
 * Aucune sinon.
 */
export function farmCardFor(
  setCards: Card[],
  signature: Signature,
  level: number,
): { farmCardId: number | null; farmCardPct: number } {
  if (level === 5) {
    const secret = findByName(
      setCards,
      BOSS_SECRET_CARD[signature.archetype] ?? signature.cardName,
    );
    if (secret?.rarity === Rarity.SECRET)
      return { farmCardId: secret.id, farmCardPct: ORIGINES_FARM_PCT };
  }
  const ancestral = signature.element
    ? setCards.find(
        (c) => c.stage === 'ancestral' && c.element === signature.element,
      )
    : undefined;
  return ancestral
    ? { farmCardId: ancestral.id, farmCardPct: ANCESTRAL_FARM_PCT }
    : { farmCardId: null, farmCardPct: 0 };
}
