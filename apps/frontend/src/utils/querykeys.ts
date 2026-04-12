export const QUERY_KEYS = {
  profile: ["user", "profile"] as const,
  myStats: ["user", "stats"] as const,
  inventory: ["user", "inventory"] as const,
  offers: ["listings", "offers"] as const,
  myListings: ["listings", "me"] as const,
  history: ["listings", "history"] as const,
  collection: ["user", "collection"] as const,
  quests: ["user", "quests"] as const,
  dailyRewardStatus: ["daily-reward", "status"] as const,
} as const;
