import type { Archetype } from "../enums/card";

/** Or offert à la réclamation d'un starter deck. */
export const STARTER_GOLD = 5000;
/** Nombre de cartes mises en avant (isFeatured) dans un starter deck. */
export const STARTER_FEATURED_COUNT = 4;

export interface StarterDeckCardView {
  cardId: number;
  quantity: number;
  isFeatured: boolean;
}

export interface StarterDeckView {
  archetype: Archetype;
  isValid: boolean;
  cards: StarterDeckCardView[];
}

/** GET starter status. `available` = non réclamé et 3 decks valides. `decks` est vide quand `available` est faux, sauf côté admin. */
export interface StarterStatus {
  claimed: boolean;
  available: boolean;
  decks: StarterDeckView[];
}

/** Corps d'une requête de sauvegarde de deck. Sans cardId dupliqué. */
export interface StarterDeckBody {
  cards: StarterDeckCardView[];
}

/** Corps d'une requête de réclamation. */
export interface ClaimStarterBody {
  archetype: Archetype;
}

/** Résultat d'une réclamation de starter deck. */
export interface ClaimStarterResult {
  archetype: Archetype;
  deckId: number;
  gold: number;
}
