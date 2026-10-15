export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Tri des listes de ventes : plus récentes ou plus chères d'abord. */
export type SaleSort = "date" | "price";

/** GET /transactions/history */
export interface HistoryQuery extends PaginationQuery {
  role?: "seller" | "buyer";
  sort?: SaleSort;
}

/** Point de vue d'un joueur sur une vente. */
export type SaleRole = "seller" | "buyer" | "both";

/** Filtre commun aux listes et aux stats de ventes. */
export interface SalesFilter {
  /** Absent = tout le marché. */
  userId?: number;
  /** Ignoré sans userId. Défaut "both". */
  role?: SaleRole;
}

/** GET /transactions/recent-sales */
export interface RecentSalesQuery extends PaginationQuery, SalesFilter {
  sort?: SaleSort;
}
