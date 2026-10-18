import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../../utils/querykeys";

/** Mutation admin Aventure : invalide la vue admin et la vue joueur au succès. */
export function useAdminAdventureMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onSuccess?: (result: TResult) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAdventure }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adventure }),
      ]);
      onSuccess?.(result);
    },
  });
}
