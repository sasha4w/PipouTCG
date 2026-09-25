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

/** GET /transactions/history */
export interface HistoryQuery extends PaginationQuery {
  role?: "seller" | "buyer";
}
