import { useContext } from "react";
import { AnimationContext } from "./animation-context";

export function useAnimationPrefs() {
  return useContext(AnimationContext);
}
