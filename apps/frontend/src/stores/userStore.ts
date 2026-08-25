/**
 * User Store - Manages user preferences and session state
 * Replaces DailyRewardContext and handles user-specific settings
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserStoreState {
  // User preferences (persistent)
  language: "en" | "fr" | "ko";
  theme: "light" | "dark" | "system";
  isFirstVisit: boolean;

  // Daily reward (session)
  isDailyRewardModalOpen: boolean;

  // Actions - Preferences
  setLanguage: (lang: "en" | "fr" | "ko") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setIsFirstVisit: (isFirst: boolean) => void;

  // Actions - Daily Reward
  openDailyRewardModal: () => void;
  closeDailyRewardModal: () => void;

  // Reset
  resetUserSettings: () => void;
}

const initialState = {
  language: "en" as const,
  theme: "system" as const,
  isFirstVisit: true,
  isDailyRewardModalOpen: false,
};

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      ...initialState,

      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme: theme }),
      setIsFirstVisit: (isFirst) => set({ isFirstVisit: isFirst }),

      openDailyRewardModal: () => set({ isDailyRewardModalOpen: true }),
      closeDailyRewardModal: () => set({ isDailyRewardModalOpen: false }),

      resetUserSettings: () => set(initialState),
    }),
    {
      name: "user-store", // localStorage key
      version: 1,
      // Only persist language, theme, isFirstVisit (not modal state)
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        isFirstVisit: state.isFirstVisit,
        isDailyRewardModalOpen: false, // Don't persist modal state
      }),
    }
  )
);
