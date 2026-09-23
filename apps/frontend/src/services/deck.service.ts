import { api } from "../api/api";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DeckCardEntry {
  userCardId: number;
  quantity: number;
}

export interface CardInDeck {
  id: number;
  name: string;
  rarity: string;
  type: string;
  atk: number;
  hp: number;
  cost: number;
  supportType?: string | null;
  description?: string | null;
  image?: { id: number; url: string } | null;
}

export interface DeckCard {
  userCard: {
    id: number;
    card: CardInDeck;
    quantity: number;
  };
  quantity: number;
}

export interface Deck {
  id: number;
  name: string;
  userId: number;
  deckCards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckDto {
  name: string;
  cards: DeckCardEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────

export const deckService = {
  /** Get all decks belonging to the authenticated user. */
  async getMyDecks(): Promise<Deck[]> {
    const res = await api.get("/decks");
    return res.data;
  },

  /** Get a single deck by id (must belong to the authenticated user). */
  async getDeck(id: number): Promise<Deck> {
    const res = await api.get(`/decks/${id}`);
    return res.data;
  },

  /** Create a new deck. */
  async createDeck(dto: CreateDeckDto): Promise<Deck> {
    const res = await api.post("/decks", dto);
    return res.data;
  },

  /** Update (replace) an existing deck. */
  async updateDeck(id: number, dto: CreateDeckDto): Promise<Deck> {
    const res = await api.put(`/decks/${id}`, dto);
    return res.data;
  },

  /** Delete a deck. */
  async deleteDeck(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/decks/${id}`);
    return res.data;
  },
};
