import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { forgeService } from "../../services/forge.service";
import { userService } from "../../services/user.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { useCardCatalog } from "../glossary/cardCatalog";
import { joinOwnedCards, type OwnedCard } from "./ownedCards";

/** Catalogue joint à la collection et aux copies utilisables du joueur. */
export function useOwnedCards(): {
  cards: OwnedCard[];
  isPending: boolean;
  isError: boolean;
} {
  const catalog = useCardCatalog();
  const collection = useQuery({
    queryKey: QUERY_KEYS.collection,
    queryFn: () => userService.getMyCollection(),
  });
  const usable = useQuery({
    queryKey: QUERY_KEYS.forgeUsable,
    queryFn: () => forgeService.usable(),
  });
  const cards = useMemo(
    () =>
      catalog.data && collection.data && usable.data
        ? joinOwnedCards(catalog.data.data, collection.data, usable.data)
        : [],
    [catalog.data, collection.data, usable.data],
  );
  return {
    cards,
    isPending: catalog.isPending || collection.isPending || usable.isPending,
    isError: catalog.isError || collection.isError || usable.isError,
  };
}
