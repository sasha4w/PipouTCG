import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { questService } from "../services/quest.service";
import { api } from "../api/api";
import { QUERY_KEYS } from "../utils/querykeys";
// --- Hook pour les données utilisateur (Or, Niveau, etc.) ---
export const useUser = () => {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data; // { id, username, gold, xp, ... }
    },
  });
};

// --- Hook pour les quêtes ---
export const useQuests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.quests,
    queryFn: () => questService.getMyQuests(),
  });
};

// --- Hook pour réclamer (avec OPTIMISTIC UPDATE) ---
export const useClaimReward = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => questService.claimReward(id),

    // Étape 1 : Quand on clique sur "Claim"
    onMutate: async (userQuestId) => {
      // On annule les refetchs en cours pour ne pas écraser l'optimisme
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.quests });

      // On sauvegarde l'état actuel (pour rollback en cas d'erreur)
      const previousQuests = queryClient.getQueryData(QUERY_KEYS.quests);

      // On modifie localement le cache de manière optimiste
      queryClient.setQueryData(QUERY_KEYS.quests, (old: any) => {
        if (!old) return old;
        // On parcourt les catégories (DAILY, WEEKLY...) pour trouver la quête
        const updated = { ...old };
        for (const key in updated) {
          updated[key] = updated[key].map((q: any) =>
            q.id === userQuestId ? { ...q, rewardClaimed: true } : q,
          );
        }
        return updated;
      });

      return { previousQuests };
    },

    // Étape 2 : Si erreur, on remet les anciennes données
    onError: (_err, _id, context) => {
      if (context?.previousQuests) {
        queryClient.setQueryData(QUERY_KEYS.quests, context.previousQuests);
      }
    },

    // Étape 3 : Dans tous les cas (succès ou erreur), on synchronise avec le serveur
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    },
  });
};
