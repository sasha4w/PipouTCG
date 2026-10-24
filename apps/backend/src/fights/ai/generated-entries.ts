import type { AdventureArchetype } from '@pipou/shared';
import { generateDeck } from '../../adventure/deck-generator';
import { LAUNCH_SIGNATURES } from '../../adventure/signatures';
import type { Card } from '../../cards/card.entity';
import type { AiLevel } from './ai-player';
import { seeded } from './tournament';
import type { TournamentEntry } from './tournament';

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];
const LEVELS: AiLevel[] = [1, 2, 3, 4, 5];

/**
 * Génère les 15 decks d'aventure en code (sans base), à graine fixe : le set
 * de chaque archétype est celui de sa carte signature, comme en production.
 * Même `deckSeed` => mêmes tirages, quelle que soit la version des cartes.
 * `excluded` : noms retirés du tirage (mesure de la valeur d'une carte).
 */
export function buildGeneratedEntries(
  allCards: Card[],
  deckSeed: number,
  excluded: readonly string[] = [],
): TournamentEntry[] {
  const cards = allCards.filter((c) => !excluded.includes(c.name));
  const entries: TournamentEntry[] = [];
  let offset = 0;
  for (const archetype of ARCHETYPES) {
    for (const level of LEVELS) {
      const signature = LAUNCH_SIGNATURES[archetype][level - 1];
      const sigCard = cards.find((c) => c.name === signature.cardName);
      const setId = sigCard?.cardSet?.id;
      const setCards = cards.filter((c) => c.cardSet?.id === setId);
      const byId = new Map(setCards.map((c) => [c.id, c]));
      const deck = generateDeck(
        setCards,
        level,
        signature,
        seeded(deckSeed + offset),
      ).flatMap((e) =>
        Array.from({ length: e.quantity }, () => byId.get(e.cardId) as Card),
      );
      entries.push({
        name: `${archetype} niveau ${level}`,
        archetype,
        level,
        deck,
      });
      offset += 1;
    }
  }
  return entries;
}
