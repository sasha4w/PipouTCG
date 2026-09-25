export const MatchStatus = {
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
  ABANDONED: "abandoned",
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const MatchEndReason = {
  PRIMES_DEPLETED: "primes_depleted",
  DECK_EMPTY: "deck_empty",
  SURRENDER: "surrender",
  DISCONNECT: "disconnect",
} as const;
export type MatchEndReason = (typeof MatchEndReason)[keyof typeof MatchEndReason];
