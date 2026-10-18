import { ADVENTURE_LEVEL_DEFAULTS } from '@pipou/shared';
import type { EntityManager } from 'typeorm';
import type { Card } from '../cards/card.entity';
import { findByName, generateDeck, type DeckEntry } from './deck-generator';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureWorld } from './entities/adventure-world.entity';
import type { Persona, Signature } from './signatures';

export const LEVELS = [1, 2, 3, 4, 5] as const;

export interface OpponentPlan {
  level: (typeof LEVELS)[number];
  signature: Signature;
  portrait: Card | undefined;
  deck: DeckEntry[];
}

/**
 * Prépare (sans rien écrire) les 5 IA d'un monde : portrait et deck générés
 * depuis la signature de chaque niveau. Une erreur ne laisse donc rien de
 * persisté. `onMissingPortrait` est appelé pour une signature sans carte.
 */
export function planOpponents(
  setCards: Card[],
  signatures: readonly Signature[],
  random: () => number,
  onMissingPortrait?: (signature: Signature) => void,
): OpponentPlan[] {
  return LEVELS.map((level) => {
    const signature = signatures[level - 1];
    const portrait = findByName(setCards, signature.cardName);
    if (!portrait) onMissingPortrait?.(signature);
    const deck = generateDeck(setCards, level, signature, random);
    return { level, signature, portrait, deck };
  });
}

export interface WorldFields {
  name: string;
  cardSetId: number;
  boosterId: number | null;
  order: number;
  isActive: boolean;
  /** Absent : aucun prérequis (relation non touchée). */
  prerequisiteIds?: number[];
}

/** Écrit le monde, ses 5 IA et leurs decks dans le `manager` (à passer en transaction). */
export async function persistWorld(
  manager: EntityManager,
  fields: WorldFields,
  plans: readonly OpponentPlan[],
  personas: readonly Persona[],
): Promise<AdventureWorld> {
  const { prerequisiteIds, ...columns } = fields;
  const world = await manager.save(
    AdventureWorld,
    manager.create(AdventureWorld, {
      ...columns,
      ...(prerequisiteIds?.length
        ? {
            prerequisites: prerequisiteIds.map(
              (id) => ({ id }) as AdventureWorld,
            ),
          }
        : {}),
    }),
  );

  for (const { level, signature, portrait, deck } of plans) {
    const persona = personas[level - 1];
    const opponent = await manager.save(
      AdventureOpponent,
      manager.create(AdventureOpponent, {
        worldId: world.id,
        position: level,
        name: persona.name,
        quote: persona.quote,
        portraitCardId: portrait?.id ?? null,
        signature: JSON.stringify(signature),
        ...ADVENTURE_LEVEL_DEFAULTS[level],
      }),
    );
    await manager.save(
      AdventureOpponentCard,
      deck.map((d) =>
        manager.create(AdventureOpponentCard, {
          opponentId: opponent.id,
          cardId: d.cardId,
          quantity: d.quantity,
        }),
      ),
    );
  }
  return world;
}
