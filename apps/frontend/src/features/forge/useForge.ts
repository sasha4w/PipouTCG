import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Rafraîchit tout ce que la forge et la destruction modifient. */
export function useInvalidateAfterForge() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        QUERY_KEYS.inventory,
        QUERY_KEYS.collection,
        QUERY_KEYS.forgeUsable,
        QUERY_KEYS.myStats,
        QUERY_KEYS.profile,
        QUERY_KEYS.quests,
        QUERY_KEYS.achievements,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}
