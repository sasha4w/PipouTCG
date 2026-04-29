import { api } from "../api/api";

export const ProductType = {
  CARD: "CARD",
  BOOSTER: "BOOSTER",
  BUNDLE: "BUNDLE",
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const TransactionStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

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
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateListingData {
  productType: ProductType;
  productId: number;
  quantity: number;
  unitPrice: number;
}

// Nouvelle interface pour correspondre au UpdateListingDto du backend
export interface UpdateListingData {
  quantity?: number;
  unitPrice?: number;
}

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

  // Historique global de l'utilisateur (achats et ventes)
  async getHistory(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/history", {
      params: { page, limit },
    });
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
    const res = await api.post(
      `/transactions/${id}/buy`,
      quantity ? { quantity } : {},
    );
    return res.data;
  },

  // Annuler son annonce
  async cancel(id: number): Promise<Transaction> {
    const res = await api.post(`/transactions/${id}/cancel`);
    return res.data;
  },
};
