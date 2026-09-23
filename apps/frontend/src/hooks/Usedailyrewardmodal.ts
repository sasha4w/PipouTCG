import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { dailyRewardService } from "../services/dailyReward.service";
import { QUERY_KEYS } from "../utils/querykeys";

/**
 * Hook à placer dans un composant haut niveau (ex: Layout ou App).
 * Ouvre automatiquement la modale si l'utilisateur n'a pas encore
 * réclamé sa récompense aujourd'hui, avec un délai pour laisser
 * la page se charger d'abord.
 */
export function useDailyRewardModal(isAuthenticated: boolean) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: status } = useQuery({
    queryKey: QUERY_KEYS.dailyRewardStatus,
    queryFn: () => dailyRewardService.getStatus(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!status) return;
    // Auto-ouvre si pas encore réclamé ou si streak en danger
    if (!status.alreadyClaimed || status.daysMissed > 0) {
      const timer = setTimeout(() => setIsOpen(true), 1200); // délai 1.2s après le login
      return () => clearTimeout(timer);
    }
  }, [status]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    status,
  };
}
