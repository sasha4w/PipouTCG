import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { soundService } from "../services/sound.service";

interface SoundContextType {
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

const SoundContext = createContext<SoundContextType | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [masterVolume, setMasterVolumeState] = useState(
    soundService.masterVolume,
  );
  const [bgmVolume, setBgmVolumeState] = useState(soundService.bgmVolume);
  const [sfxVolume, setSfxVolumeState] = useState(soundService.sfxVolume);
  const [muted, setMutedState] = useState(soundService.muted);
  const [bgmMuted, setBgmMutedState] = useState(soundService.bgmMuted);
  const [sfxMuted, setSfxMutedState] = useState(soundService.sfxMuted);

  const setMasterVolume = useCallback((v: number) => {
    soundService.setMasterVolume(v);
    setMasterVolumeState(v);
  }, []);

  const setBgmVolume = useCallback((v: number) => {
    soundService.setBgmVolume(v);
    setBgmVolumeState(v);
  }, []);

  const setSfxVolume = useCallback((v: number) => {
    soundService.setSfxVolume(v);
    setSfxVolumeState(v);
  }, []);

  const toggleMute = useCallback(() => {
    soundService.toggleMute();
    setMutedState(soundService.muted);
  }, []);

  const toggleBgmMute = useCallback(() => {
    soundService.toggleBgmMute();
    setBgmMutedState(soundService.bgmMuted);
  }, []);

  const toggleSfxMute = useCallback(() => {
    soundService.toggleSfxMute();
    setSfxMutedState(soundService.sfxMuted);
  }, []);

  return (
    <SoundContext.Provider
      value={{
        masterVolume,
        bgmVolume,
        sfxVolume,
        muted,
        bgmMuted,
        sfxMuted,
        setMasterVolume,
        setBgmVolume,
        setSfxVolume,
        toggleMute,
        toggleBgmMute,
        toggleSfxMute,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundStore() {
  const ctx = useContext(SoundContext);
  if (!ctx)
    throw new Error("useSoundStore must be used inside <SoundProvider>");
  return ctx;
}
