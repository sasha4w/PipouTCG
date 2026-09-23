/**
 * Bundle Manager Store - Manages bundle CRUD operations
 * Extracted from BundleManager.tsx
 */

import { create } from "zustand";

export interface BundleItem {
  productType: string;
  productId: number;
  quantity: number;
}

export interface BundleForm {
  name: string;
  description: string;
  price: number;
  items: BundleItem[];
}

export interface BundleManagerState {
  // List state
  bundles: any[];
  page: number;
  total: number;
  loading: boolean;
  error: string;
  saving: boolean;

  // View & form
  view: "list" | "edit";
  step: number;
  editing: any | null;
  form: BundleForm;

  // Actions
  setBundles: (bundles: any[]) => void;
  setPage: (page: number) => void;
  setTotal: (total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSaving: (saving: boolean) => void;

  switchToList: () => void;
  switchToEdit: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  setEditing: (bundle: any | null) => void;
  updateForm: (field: string, value: any) => void;
  resetForm: () => void;

  reset: () => void;
}

const initialForm: BundleForm = {
  name: "",
  description: "",
  price: 0,
  items: [],
};

const initialState = {
  bundles: [],
  page: 1,
  total: 0,
  loading: true,
  error: "",
  saving: false,
  view: "list" as const,
  step: 1,
  editing: null,
  form: initialForm,
};

export const useBundleManagerStore = create<BundleManagerState>((set) => ({
  ...initialState,

  setBundles: (bundles) => set({ bundles }),
  setPage: (page) => set({ page }),
  setTotal: (total) => set({ total }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSaving: (saving) => set({ saving }),

  switchToList: () => set({ view: "list", step: 1, editing: null, form: initialForm }),
  switchToEdit: () => set({ view: "edit" }),
  setStep: (step) => set({ step }),
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: Math.max(1, state.step - 1) })),

  setEditing: (bundle) => set({ editing: bundle }),
  updateForm: (field, value) =>
    set((state) => ({
      form: { ...state.form, [field]: value },
    })),
  resetForm: () => set({ form: initialForm, editing: null }),

  reset: () => set(initialState),
}));
