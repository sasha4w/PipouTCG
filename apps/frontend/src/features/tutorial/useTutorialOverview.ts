import { useQuery } from "@tanstack/react-query";
import { tutorialService } from "../../services/tutorial.service";
import { QUERY_KEYS } from "../../utils/querykeys";

export function useTutorialOverview() {
  return useQuery({
    queryKey: QUERY_KEYS.tutorial,
    queryFn: () => tutorialService.getOverview(),
  });
}
