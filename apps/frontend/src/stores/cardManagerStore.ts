/**
 * Card Manager Store - Manages card CRUD operations and form state
 * Extracted from CardManager.tsx to reduce component complexity
 */

import { create } from "zustand";
import type { Card } from "../services/card.service";

export interface CardManagerState {
  // List state
  cards: Card[];
  total: number;
  page: number;
  search: string;
  groupBySet: boolean;
  loading: boolean;
  error: string;
  saving: boolean;

  // View & form state
  view: "list" | "edit";
  step: number;
  editing: Card | null;

  // Form data
  form: {
    name: string;
    rarity: string;
    type: string;
    atk: number;
    hp: number;
    cost: number;
    cardSetId: number;
  };

  // Image upload
  imageFile: File | null;
  imageName: string;
  uploadMode: "existing" | "new";
  selectedImageId: number | null;

  // Actions - List management
  setCards: (cards: Card[]) => void;
  setTotal: (total: number) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setGroupBySet: (group: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSaving: (saving: boolean) => void;

  // Actions - View management
  switchToList: () => void;
  switchToEdit: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Actions - Form management
  setEditing: (card: Card | null) => void;
  updateForm: (field: string, value: any) => void;
  resetForm: () => void;

  // Actions - Image upload
  setImageFile: (file: File | null) => void;
  setImageName: (name: string) => void;
  setUploadMode: (mode: "existing" | "new") => void;
  setSelectedImageId: (id: number | null) => void;

  // Reset everything
  reset: () => void;
}

const initialForm = {
  name: "",
  rarity: "common",
  type: "monster",
  atk: 0,
  hp: 0,
  cost: 1,
  cardSetId: 0,
};

const initialState = {
  cards: [],
  total: 0,
  page: 1,
  search: "",
  groupBySet: false,
  loading: true,
  error: "",
  saving: false,
  view: "list" as const,
  step: 1,
  editing: null,
  form: initialForm,
  imageFile: null,
  imageName: "",
  uploadMode: "existing" as const,
  selectedImageId: null,
};

export const useCardManagerStore = create<CardManagerState>((set) => ({
  ...initialState,

  // List actions
  setCards: (cards) => set({ cards }),
  setTotal: (total) => set({ total }),
  setPage: (page) => set({ page }),
  setSearch: (search) => set({ search }),
  setGroupBySet: (group) => set({ groupBySet: group }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSaving: (saving) => set({ saving }),

  // View actions
  switchToList: () => set({ view: "list", step: 1, editing: null, form: initialForm }),
  switchToEdit: () => set({ view: "edit" }),
  setStep: (step) => set({ step }),
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: Math.max(1, state.step - 1) })),

  // Form actions
  setEditing: (card) => set({ editing: card }),
  updateForm: (field, value) =>
    set((state) => ({
      form: { ...state.form, [field]: value },
    })),
  resetForm: () => set({ form: initialForm, editing: null }),

  // Image actions
  setImageFile: (file) => set({ imageFile: file }),
  setImageName: (name) => set({ imageName: name }),
  setUploadMode: (mode) => set({ uploadMode: mode }),
  setSelectedImageId: (id) => set({ selectedImageId: id }),

  // Reset
  reset: () => set(initialState),
}));
