/** Règles de construction d'un deck (création et lancement de match). */
export const DECK_RULES = { MIN_CARDS: 30, MAX_CARDS: 40, MAX_COPIES: 3 } as const;

/** Primes mises de côté en début de partie. */
export const STARTING_PRIMES = 6;

/** Taille de la main de départ. */
export const STARTING_HAND = 5;

/** Nombre maximum de cartes en main à la fin du tour. */
export const HAND_LIMIT = 7;
