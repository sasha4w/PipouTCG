import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { questService } from "../services/quest.service";
import { achievementService } from "../services/achievement.service";
import {
  QUEST_LIST_KEYS,
  type AchievementFamily,
  type UserQuestsResponse,
} from "@pipou/shared";
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
      queryClient.setQueryData<UserQuestsResponse>(QUERY_KEYS.quests, (old) => {
        if (!old) return old;
        // On parcourt les catégories (DAILY, WEEKLY...) pour trouver la quête
        const updated = { ...old };
        for (const key of QUEST_LIST_KEYS) {
          updated[key] = old[key].map((q) =>
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

export const useRerollQuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userQuestId: number) => questService.reroll(userQuestId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests }),
  });
};

export const useAchievements = () =>
  useQuery({
    queryKey: QUERY_KEYS.achievements,
    queryFn: () => achievementService.getMine(),
  });

export const useClaimAchievement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (family: AchievementFamily) => achievementService.claim(family),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    },
  });
};

export const useClaimAllAchievements = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (family?: AchievementFamily) => achievementService.claimAll(family),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    },
  });
};

export const useSetTitle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (family: AchievementFamily | null) => achievementService.setTitle(family),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
    },
  });
};
