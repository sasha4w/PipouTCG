/**
 * UI Store - Manages application UI state
 * Handles modals, tabs, toasts, filters, and loading states
 */

import { create } from "zustand";

export type Tab = "fight" | "history" | "leaderboard" | "rules";

export interface Toast {
  msg: string;
  type: "err" | "ok";
}

export interface UIStoreState {
  // Tabs & modals
  activeTab: Tab;
  isCardPickModalOpen: boolean;
  isSettingsOpen: boolean;
  isConfirmDialogOpen: boolean;

  // Toast notifications
  toast: Toast | null;

  // Filters & selections
  marketplaceFilters: {
    rarity?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  };
  deckSearchTerm: string;

  // Loading states
  isLoadingMatch: boolean;
  isLoadingCards: boolean;

  // Actions
  setActiveTab: (tab: Tab) => void;
  openCardPickModal: () => void;
  closeCardPickModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openConfirmDialog: () => void;
  closeConfirmDialog: () => void;

  // Toast actions
  showToast: (msg: string, type: "err" | "ok") => void;
  dismissToast: () => void;

  // Filters & search
  setMarketplaceFilters: (filters: UIStoreState["marketplaceFilters"]) => void;
  clearMarketplaceFilters: () => void;
  setDeckSearchTerm: (term: string) => void;

  // Loading states
  setLoadingMatch: (loading: boolean) => void;
  setLoadingCards: (loading: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  activeTab: "fight" as const,
  isCardPickModalOpen: false,
  isSettingsOpen: false,
  isConfirmDialogOpen: false,
  toast: null,
  marketplaceFilters: {},
  deckSearchTerm: "",
  isLoadingMatch: false,
  isLoadingCards: false,
};

export const useUIStore = create<UIStoreState>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),
  openCardPickModal: () => set({ isCardPickModalOpen: true }),
  closeCardPickModal: () => set({ isCardPickModalOpen: false }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openConfirmDialog: () => set({ isConfirmDialogOpen: true }),
  closeConfirmDialog: () => set({ isConfirmDialogOpen: false }),

  showToast: (msg, type) =>
    set({
      toast: { msg, type },
      // Auto-dismiss toast after 3 seconds
    }),
  dismissToast: () => set({ toast: null }),

  setMarketplaceFilters: (filters) =>
    set({ marketplaceFilters: filters }),
  clearMarketplaceFilters: () =>
    set({ marketplaceFilters: {} }),
  setDeckSearchTerm: (term) => set({ deckSearchTerm: term }),

  setLoadingMatch: (loading) => set({ isLoadingMatch: loading }),
  setLoadingCards: (loading) => set({ isLoadingCards: loading }),

  reset: () => set(initialState),
}));
