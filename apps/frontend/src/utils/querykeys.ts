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
} as const;
