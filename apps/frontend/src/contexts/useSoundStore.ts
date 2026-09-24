import { useContext } from "react";
import { SoundContext } from "./sound-context";

export function useSoundStore() {
  const ctx = useContext(SoundContext);
  if (!ctx)
    throw new Error("useSoundStore must be used inside <SoundProvider>");
  return ctx;
}
