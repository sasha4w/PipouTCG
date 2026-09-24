import { createContext } from "react";

export interface SoundContextType {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
  setMasterVolume: (v: number) => void;
  setBgmVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  toggleMute: () => void;
  toggleBgmMute: () => void;
  toggleSfxMute: () => void;
}

export const SoundContext = createContext<SoundContextType | null>(null);
