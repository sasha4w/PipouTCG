/** GET /transactions/stats — stats des ventes conclues pour un SalesFilter. */
export interface SalesStats {
  /** Transactions COMPLETED. */
  count: number;
  /** Somme des prix totaux. */
  totalGold: number;
  /** Somme des quantités. */
  unitsTraded: number;
  /** totalGold / unitsTraded, arrondi ; null sans vente. */
  avgUnitPrice: number | null;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
  biggestSale: {
    id: number;
    itemName: string;
    totalPrice: number;
    quantity: number;
    /** ISO 8601. */
    date: string;
  } | null;
  topItem: { itemName: string; units: number } | null;
  /** Joueur avec qui le joueur filtré a le plus échangé. null sans userId. */
  topPartner: { userId: number; username: string; count: number } | null;
  /** Jour le plus riche des 30 derniers jours. null si aucun or échangé. */
  bestDay: { date: string; gold: number } | null;
  /** Or des 7 derniers jours vs les 7 précédents. percent null si previous7 = 0. */
  trend: { last7: number; previous7: number; percent: number | null };
  /** Exactement 30 entrées, de J-29 à aujourd'hui (UTC), jours vides à 0. date = "YYYY-MM-DD". */
  daily: { date: string; gold: number }[];
}
