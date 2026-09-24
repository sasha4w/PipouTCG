import { useState, useCallback } from "react";
import { SoundContext } from "./sound-context";
import type { ReactNode } from "react";
import { soundService } from "../services/sound.service";


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
