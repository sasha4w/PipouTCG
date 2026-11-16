import { useQuery } from "@tanstack/react-query";
import { puzzleService } from "../../services/puzzle.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Défi du jour, partagé par la carte d'arène et la fiche. */
export function useTodayPuzzle() {
  return useQuery({
    queryKey: QUERY_KEYS.puzzleToday,
    queryFn: () => puzzleService.today(),
  });
}
