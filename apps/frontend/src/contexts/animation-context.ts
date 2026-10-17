import { createContext } from "react";

export type AnimationPreference = "auto" | "full" | "reduced";

export interface AnimationContextType {
  preference: AnimationPreference;
  setPreference: (p: AnimationPreference) => void;
  /** Animations réduites : choix explicite, ou « auto » + préférence système. */
  reduced: boolean;
}

export const AnimationContext = createContext<AnimationContextType>({
  preference: "auto",
  setPreference: () => {},
  reduced: false,
});
