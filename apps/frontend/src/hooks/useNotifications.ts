import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationCategory } from "@pipou/shared";
import { notificationService } from "../services/notification.service";
import { QUERY_KEYS } from "../utils/querykeys";

export type InboxTab = "all" | NotificationCategory;

export const useNotifications = (tab: InboxTab) =>
  useQuery({
    queryKey: QUERY_KEYS.notifications.list(tab),
    queryFn: () => notificationService.list(tab === "all" ? undefined : tab),
  });

/** Appelé à la fermeture de la boîte : les messages vus passent en lu. */
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all }),
  });
};

const API_URL = import.meta.env.VITE_API_URL;

/** SSE privé : un nouveau message arrive ou les quêtes progressent, on recharge. */
export function useNotificationEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const es = new EventSource(`${API_URL}/notifications/events`, {
      withCredentials: true,
    });
    es.addEventListener("notification.created", () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    });
    // La progression est enregistrée après la réponse de l'action : sans ce
    // signal, le refetch qui suit l'action relit l'ancienne progression.
    es.addEventListener("quests.updated", () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
    });
    es.onerror = (err) => console.error("SSE notifications disconnected", err);
    return () => es.close();
  }, [queryClient]);
}
