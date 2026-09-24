export const QUERY_KEYS = {
  // ── User ──────────────────────────────────────────────────────────────────
  profile: ["user", "profile"] as const,
  myStats: ["user", "stats"] as const,
  inventory: ["user", "inventory"] as const,
  collection: ["user", "collection"] as const,
  quests: ["user", "quests"] as const,
  dailyRewardStatus: ["daily-reward", "status"] as const,

  // ── Marketplace ───────────────────────────────────────────────────────────
  offers: ["listings", "offers"] as const,
  myListings: ["listings", "me"] as const,
  history: ["listings", "history"] as const,

  // ── Decks ─────────────────────────────────────────────────────────────────
  decks: ["decks"] as const,
  deck: (id: number) => ["decks", id] as const,

  // ── Cards (bibliothèque globale - plus utilisé ici) ───────────────────────
  cardsSearch: (search: string, page: number) =>
    ["cards", "search", search, page] as const,

  // ── Fight ─────────────────────────────────────────────────────────────────
  fightHistory: ["fight", "history"] as const,
  fightStats: ["fight", "stats"] as const,
  leaderboard: ["fight", "leaderboard"] as const,

  // ── Catalogue (listes d'options des formulaires) ──────────────────────────
  cardSetOptions: ["card-sets", "options"] as const,
  boosterOptions: ["boosters", "options"] as const,
  cardOptions: ["cards", "options"] as const,
  imageOptions: ["images", "options"] as const,
  cardsBySet: (setId: number, page: number) =>
    ["cards", "set", setId, page] as const,
  bundleOptions: ["bundles", "options"] as const,

  // ── Admin (écrans de gestion, paginés) ────────────────────────────────────
  admin: {
    all: ["admin"] as const,
    boosters: (page: number) => ["admin", "boosters", page] as const,
    bundles: (page: number) => ["admin", "bundles", page] as const,
    cards: (page: number) => ["admin", "cards", page] as const,
    cardSets: (page: number) => ["admin", "card-sets", page] as const,
    quests: ["admin", "quests"] as const,
    banners: ["admin", "banners"] as const,
  },
} as const;
