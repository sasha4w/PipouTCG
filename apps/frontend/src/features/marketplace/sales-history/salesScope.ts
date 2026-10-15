import type { SaleRole, SalesFilter } from "@pipou/shared";

export interface SalesPlayer {
  id: number;
  username: string;
}

/** Ventes affichées : tout le marché, ou un joueur dans un rôle. */
export type SalesScope =
  | { kind: "market" }
  | { kind: "player"; player: SalesPlayer; role: SaleRole };

export const MARKET_SCOPE: SalesScope = { kind: "market" };

export function scopeToFilter(scope: SalesScope): SalesFilter {
  return scope.kind === "market"
    ? {}
    : { userId: scope.player.id, role: scope.role };
}

export const formatGold = (gold: number) => `${gold} G`;
