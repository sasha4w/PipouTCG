import { requiresAllElements } from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { findByName } from './deck-generator';
import type { Signature } from './signatures';

/** Taux de la carte précise : Ancestral d'un niveau d'élément, Drakon des Origines du boss. */
export const ANCESTRAL_FARM_PCT = 5;
export const ORIGINES_FARM_PCT = 1;

/**
 * Carte précise qui tombe en farm contre l'IA de `signature` au `level` :
 * l'Ancestral de son élément, ou, pour un boss qui réclame les 4 éléments,
 * sa carte signature. Aucune sinon.
 */
export function farmCardFor(
  setCards: Card[],
  signature: Signature,
  level: number,
): { farmCardId: number | null; farmCardPct: number } {
  const sig = findByName(setCards, signature.cardName);
  if (level === 5 && sig && requiresAllElements(sig.effects))
    return { farmCardId: sig.id, farmCardPct: ORIGINES_FARM_PCT };
  const ancestral = signature.element
    ? setCards.find(
        (c) => c.stage === 'ancestral' && c.element === signature.element,
      )
    : undefined;
  return ancestral
    ? { farmCardId: ancestral.id, farmCardPct: ANCESTRAL_FARM_PCT }
    : { farmCardId: null, farmCardPct: 0 };
}
