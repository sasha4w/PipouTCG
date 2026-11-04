import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deckService, type Deck } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Bascule le favori d'un deck : affichage immédiat, resynchro ensuite. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (deck: Deck) => deckService.setFavorite(deck.id, !deck.isFavorite),
    onMutate: (deck) => {
      queryClient.setQueryData<Deck[]>(QUERY_KEYS.decks, (decks) =>
        decks?.map((d) =>
          d.id === deck.id ? { ...d, isFavorite: !deck.isFavorite } : d,
        ),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.decks }),
  });
  return (deck: Deck) => mutation.mutate(deck);
}
