/**
 * Audio Store - Manages audio settings and preferences
 * Replaces SoundContext from contexts/SoundContext.tsx
 * Handles master volume, BGM, SFX, and mute states
 *
 * Note: The soundService is still used for playing sounds and controlling Howler.js
 * This store just manages the volume/mute state and persists to localStorage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SfxName } from "../services/sound.service";
import { soundService } from "../services/sound.service";

export interface AudioStoreState {
  // Volume settings (0-100)
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;

  // Mute states
  isMasterMuted: boolean;
  isBgmMuted: boolean;
  isSfxMuted: boolean;

  // Actions
  setMasterVolume: (volume: number) => void;
  setBgmVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;

  // Mute/unmute actions
  toggleMasterMute: () => void;
  toggleBgmMute: () => void;
  toggleSfxMute: () => void;
  setMasterMuted: (muted: boolean) => void;
  setBgmMuted: (muted: boolean) => void;
  setSfxMuted: (muted: boolean) => void;

  // Sound playback
  playSfx: (name: SfxName) => void;

  // Reset to defaults
  resetAudioSettings: () => void;
}

const initialState = {
  masterVolume: 80,
  bgmVolume: 70,
  sfxVolume: 80,
  isMasterMuted: false,
  isBgmMuted: false,
  isSfxMuted: false,
};

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set) => ({
      ...initialState,

      setMasterVolume: (volume) => {
        const v = Math.max(0, Math.min(100, volume));
        soundService.setMasterVolume(v / 100); // Convert to 0-1 range
        set({ masterVolume: v });
      },
      setBgmVolume: (volume) => {
        const v = Math.max(0, Math.min(100, volume));
        soundService.setBgmVolume(v / 100); // Convert to 0-1 range
        set({ bgmVolume: v });
      },
      setSfxVolume: (volume) => {
        const v = Math.max(0, Math.min(100, volume));
        soundService.setSfxVolume(v / 100); // Convert to 0-1 range
        set({ sfxVolume: v });
      },

      toggleMasterMute: () =>
        set((state) => {
          const newMuted = !state.isMasterMuted;
          soundService.toggleMute();
          return { isMasterMuted: newMuted };
        }),
      toggleBgmMute: () =>
        set((state) => {
          const newMuted = !state.isBgmMuted;
          soundService.toggleBgmMute();
          return { isBgmMuted: newMuted };
        }),
      toggleSfxMute: () =>
        set((state) => {
          const newMuted = !state.isSfxMuted;
          soundService.toggleSfxMute();
          return { isSfxMuted: newMuted };
        }),

      setMasterMuted: (muted) => {
        if (muted !== soundService.muted) {
          soundService.toggleMute();
        }
        set({ isMasterMuted: muted });
      },
      setBgmMuted: (muted) => {
        if (muted !== soundService.bgmMuted) {
          soundService.toggleBgmMute();
        }
        set({ isBgmMuted: muted });
      },
      setSfxMuted: (muted) => {
        if (muted !== soundService.sfxMuted) {
          soundService.toggleSfxMute();
        }
        set({ isSfxMuted: muted });
      },

      playSfx: (name) => {
        soundService.play(name);
      },

      resetAudioSettings: () => {
        set(initialState);
        soundService.setMasterVolume(initialState.masterVolume / 100);
        soundService.setBgmVolume(initialState.bgmVolume / 100);
        soundService.setSfxVolume(initialState.sfxVolume / 100);
      },
    }),
    {
      name: "audio-store", // localStorage key
      version: 1,
    }
  )
);
