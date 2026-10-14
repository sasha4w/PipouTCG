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

/** GET /transactions/recent-sales */
export interface RecentSalesQuery extends PaginationQuery {
  sort?: SaleSort;
}
