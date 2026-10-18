import { useQuery } from "@tanstack/react-query";
import { adventureService } from "../../services/adventure.service";
import { QUERY_KEYS } from "../../utils/querykeys";

export function useAdventureOverview() {
  return useQuery({
    queryKey: QUERY_KEYS.adventure,
    queryFn: () => adventureService.getOverview(),
  });
}
