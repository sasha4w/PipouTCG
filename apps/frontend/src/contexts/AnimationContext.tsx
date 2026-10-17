import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  AnimationContext,
  type AnimationPreference,
} from "./animation-context";

const LS_ANIMATIONS = "pipou_animations";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): AnimationPreference {
  try {
    const stored = localStorage.getItem(LS_ANIMATIONS);
    return stored === "full" || stored === "reduced" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const systemPrefersReduced = () => window.matchMedia(REDUCED_QUERY).matches;

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemReduced = useSyncExternalStore(
    subscribeSystem,
    systemPrefersReduced,
    () => false,
  );

  const setPreference = useCallback((p: AnimationPreference) => {
    try {
      localStorage.setItem(LS_ANIMATIONS, p);
    } catch {
      // Stockage indisponible : le choix vaut pour la session
    }
    setPreferenceState(p);
  }, []);

  const reduced =
    preference === "reduced" || (preference === "auto" && systemReduced);

  const value = useMemo(
    () => ({ preference, setPreference, reduced }),
    [preference, setPreference, reduced],
  );

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
}
