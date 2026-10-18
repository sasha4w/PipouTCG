import {
  DrakonElement,
  RARITY_RANK,
  type AdventureArchetype,
} from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import type { Signature } from './signatures';

const ARCHETYPES: readonly AdventureArchetype[] = [
  'pipou',
  'pixelman',
  'dragon',
];

/** Rareté maximale (rang de RARITY_RANK) de la carte signature, par niveau 1..5. */
const LEVEL_MAX_RANK = [1, 2, 3, 4, 5] as const;

/** Éléments mis en avant aux niveaux 1..4 d'un monde Drakon (le boss n'en a pas). */
const DRAGON_ELEMENTS: readonly DrakonElement[] = [
  DrakonElement.EARTH,
  DrakonElement.FIRE,
  DrakonElement.WATER,
  DrakonElement.WIND,
];

/** Archétype majoritaire du set (égalité : ordre pipou, pixelman, dragon). */
export function majorityArchetype(setCards: Card[]): AdventureArchetype | null {
  const counts = new Map<AdventureArchetype, number>();
  for (const c of setCards)
    if (c.archetype && ARCHETYPES.includes(c.archetype))
      counts.set(c.archetype, (counts.get(c.archetype) ?? 0) + 1);
  let best: AdventureArchetype | null = null;
  let bestCount = 0;
  for (const a of ARCHETYPES) {
    const n = counts.get(a) ?? 0;
    if (n > bestCount) {
      best = a;
      bestCount = n;
    }
  }
  return best;
}

/** La plus rare des cartes de `pool` sous le plafond du niveau (sinon la moins rare). */
function pickSignatureCard(pool: Card[], level: number): Card {
  const sorted = [...pool].sort(
    (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.id - b.id,
  );
  const cap = LEVEL_MAX_RANK[level - 1];
  const within = sorted.filter((c) => RARITY_RANK[c.rarity] <= cap);
  if (within.length === 0) return sorted[0];
  const top = RARITY_RANK[within[within.length - 1].rarity];
  return within.find((c) => RARITY_RANK[c.rarity] === top) as Card;
}

/**
 * Signatures par défaut des 5 IA d'un nouveau monde (null : aucun archétype).
 * Règle : archétype = majorité des cartes du set. Niveau n (1..5) = la carte
 * de cet archétype la plus rare dont le rang de rareté est <= n (commun=0 ...
 * secret=5), à égalité l'id le plus bas ; le boss (5) prend donc la plus rare
 * du set. Archétype dragon : les niveaux 1..4 se limitent aux cartes d'un
 * élément (terre, feu, eau, vent ; stades non-œuf d'abord), le boss n'a pas
 * d'élément.
 */
export function defaultSignatures(setCards: Card[]): Signature[] | null {
  const archetype = majorityArchetype(setCards);
  if (!archetype) return null;
  const pool = setCards.filter((c) => c.archetype === archetype);

  return [1, 2, 3, 4, 5].map((level): Signature => {
    if (archetype === 'dragon' && level < 5) {
      const element = DRAGON_ELEMENTS[level - 1];
      const ofElement = pool.filter((c) => c.element === element);
      const grown = ofElement.filter((c) => c.stage && c.stage !== 'egg');
      const candidates = grown.length > 0 ? grown : ofElement;
      if (candidates.length > 0)
        return {
          archetype,
          cardName: pickSignatureCard(candidates, level).name,
          element,
        };
    }
    return { archetype, cardName: pickSignatureCard(pool, level).name };
  });
}
