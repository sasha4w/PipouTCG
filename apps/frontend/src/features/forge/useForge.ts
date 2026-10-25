import { useQuery, useQueryClient } from "@tanstack/react-query";
import { forgeService } from "../../services/forge.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Copies utilisables par carte, indexées par id de carte. */
export function useUsableByCard() {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.forgeUsable,
    queryFn: () => forgeService.usable(),
  });
  const map = new Map<number, number>();
  for (const u of data ?? []) map.set(u.cardId, u.usable);
  return map;
}

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
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}
