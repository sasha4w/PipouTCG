import { useEffect } from "react";

/** Nombre d'écrans de combat montés : la classe ne part qu'avec le dernier. */
let mounted = 0;

/** Masque l'en-tête et le pied de page de l'app pendant un combat (classe `in-fight`). */
export function useHideAppChrome(): void {
  useEffect(() => {
    mounted += 1;
    document.body.classList.add("in-fight");
    return () => {
      mounted -= 1;
      if (mounted === 0) document.body.classList.remove("in-fight");
    };
  }, []);
}
