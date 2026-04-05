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

// --- AJOUT DES INTERFACES POUR LES DÉTAILS ---
// Ces interfaces permettent à TS de savoir ce qu'il y a dans listing.card, etc.
interface ItemDetails {
  id: number;
  name: string;
  imageUrl?: string;
  rarity?: string;
}

export interface Transaction {
  id: number;
  productType: ProductType;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: TransactionStatus;
  createdAt: string;
  seller: { id: number; username: string };
  buyer?: { id: number; username: string } | null;

  // ✅ AJOUT DES RELATIONS REÇUES DU BACKEND
  card?: ItemDetails;
  booster?: ItemDetails;
  bundle?: ItemDetails;
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

export const transactionService = {
  // Toutes les annonces PENDING (marketplace)
  async findAll(page = 1, limit = 20): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions", { params: { page, limit } });
    return res.data;
  },

  async findMyListings(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/me", { params: { page, limit } });
    return res.data;
  },

  async findOffers(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/offers", {
      params: { page, limit },
    });
    return res.data;
  },

  // Créer une annonce
  async createListing(data: CreateListingData): Promise<Transaction> {
    const res = await api.post("/transactions/listing", data);
    return res.data;
  },

  // Acheter une annonce
  async buy(id: number): Promise<Transaction> {
    const res = await api.post(`/transactions/${id}/buy`);
    return res.data;
  },

  // Annuler son annonce
  async cancel(id: number): Promise<Transaction> {
    const res = await api.post(`/transactions/${id}/cancel`);
    return res.data;
  },

  // Historique de l'utilisateur connecté
  async getHistory(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    const res = await api.get("/transactions/history", {
      params: { page, limit },
    });
    return res.data;
  },
};
