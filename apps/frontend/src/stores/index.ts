/**
 * Stores index - Export all Zustand stores
 * Example: import { useGameStore, useUIStore } from '@/stores'
 */

import { useAudioStore } from "./audioStore";

export { useGameStore, type GameStoreState } from "./gameStore";
export { useUIStore, type UIStoreState } from "./uiStore";
export { useAudioStore, type AudioStoreState } from "./audioStore";
export { useUserStore, type UserStoreState } from "./userStore";

/**
 * Compatibility alias for migration from useSoundStore (Context API)
 * This hook provides the same API but now uses Zustand
 * Gradually migrate consumers from useSoundStore() to useAudioStore()
 */
export const useSoundStore = () => {
  const audioStore = useAudioStore();
  // Map audioStore properties to old SoundContextType interface
  return {
    masterVolume: audioStore.masterVolume,
    bgmVolume: audioStore.bgmVolume,
    sfxVolume: audioStore.sfxVolume,
    muted: audioStore.isMasterMuted,
    bgmMuted: audioStore.isBgmMuted,
    sfxMuted: audioStore.isSfxMuted,
    setMasterVolume: audioStore.setMasterVolume,
    setBgmVolume: audioStore.setBgmVolume,
    setSfxVolume: audioStore.setSfxVolume,
    toggleMute: audioStore.toggleMasterMute,
    toggleBgmMute: audioStore.toggleBgmMute,
    toggleSfxMute: audioStore.toggleSfxMute,
  };
};

/**
 * Manager stores - State management for admin panels
 * Extracted from complex components for better maintainability
 */
export { useCardManagerStore } from "./cardManagerStore";
export { useBundleManagerStore } from "./bundleManagerStore";
