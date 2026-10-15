import { api } from "../api/api";
import type {
  BuyRequest,
  CreateListingRequest,
  HistoryQuery,
  RecentSalesQuery,
  SaleSort,
  SalesFilter,
  SalesStats,
  PaginatedResponse,
  UpdateListingRequest,
} from "@pipou/shared";
import { ProductType, TransactionStatus } from "@pipou/shared";
import type { Card } from "./card.service";

export { ProductType, TransactionStatus };

export interface Transaction {
  id: number;
  productType: ProductType;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt?: string; // Ajout recommandé basé sur le tri backend (updatedAt: 'DESC')
  seller: { id: number; username: string };
  buyer?: { id: number; username: string } | null;
  itemName?: string;
  /** Carte vendue, jointe par le serveur aux annonces actives (null hors cartes). */
  card?: Card | null;
}

export type { PaginatedResponse };
export type CreateListingData = CreateListingRequest;
export type UpdateListingData = UpdateListingRequest;

/** Ventes chargées dans « Détails », paginées ensuite côté client. */
export const SALES_LIST_LIMIT = 100;

export const transactionService = {
  // ============================================================
  // 🟢 ANNONCES ACTIVES (PENDING)
  // ============================================================

  // Toutes les annonces PENDING (admin uniquement sur le backend)
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions", { params: { page, limit } });
    return res.data;
  },

  // Annonces des autres joueurs (marketplace public)
  async findOffers(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/offers", {
      params: { page, limit },
    });
    return res.data;
  },

  // Mes annonces actives
  async findMyListings(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/me", { params: { page, limit } });
    return res.data;
  },

  async getHistory(
    page = 1,
    limit = 20,
    role?: HistoryQuery["role"],
    sort: SaleSort = "date",
  ): Promise<PaginatedResponse<Transaction>> {
    const params: HistoryQuery = {
      page,
      limit,
      sort,
      ...(role ? { role } : {}),
    };
    const res = await api.get("/transactions/history", { params });
    return res.data;
  },

  // Ajouter
  async getRecentSales(
    page = 1,
    limit = 20,
    sort: SaleSort = "date",
  ): Promise<PaginatedResponse<Transaction>> {
    const params: RecentSalesQuery = { page, limit, sort };
    const res = await api.get("/transactions/recent-sales", { params });
    return res.data;
  },

  // Ventes conclues : tout le marché ou un joueur (vendeur, acheteur, les deux)
  async getSales(
    filter: SalesFilter,
    sort: SaleSort = "date",
  ): Promise<PaginatedResponse<Transaction>> {
    const params: RecentSalesQuery = {
      page: 1,
      limit: SALES_LIST_LIMIT,
      sort,
      ...filter,
    };
    const res = await api.get("/transactions/recent-sales", { params });
    return res.data;
  },

  // Stats et série 30 jours pour le même filtre
  async getSalesStats(filter: SalesFilter): Promise<SalesStats> {
    const res = await api.get("/transactions/stats", { params: filter });
    return res.data;
  },

  // ============================================================
  // 🟣 TRANSACTIONS COMPLÉTÉES
  // ============================================================

  // Toutes les transactions complétées (admin uniquement sur le backend)
  async findCompleted(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/completed", {
      params: { page, limit },
    });
    return res.data;
  },

  // Détail d'une transaction complétée par ID
  async findCompletedById(id: number): Promise<Transaction> {
    const res = await api.get(`/transactions/completed/${id}`);
    return res.data;
  },

  // ============================================================
  // 🟡 ACTIONS SUR LES ANNONCES
  // ============================================================

  // Créer une annonce
  async createListing(data: CreateListingData): Promise<Transaction> {
    const res = await api.post("/transactions/listing", data);
    return res.data;
  },

  // Modifier une annonce (Nouveau)
  async updateListing(
    id: number,
    data: UpdateListingData,
  ): Promise<Transaction> {
    const res = await api.patch(`/transactions/${id}`, data);
    return res.data;
  },

  // Acheter une annonce (gère l'achat partiel via le quantity optionnel)
  async buy(id: number, quantity?: number): Promise<Transaction> {
    const body: BuyRequest = quantity ? { quantity } : {};
    const res = await api.post(`/transactions/${id}/buy`, body);
    return res.data;
  },

  // Annuler son annonce
  async cancel(id: number): Promise<Transaction> {
    const res = await api.post(`/transactions/${id}/cancel`);
    return res.data;
  },
};
