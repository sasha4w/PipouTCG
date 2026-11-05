import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { starterDeckService } from "../services/starterDeck.service";
import { QUERY_KEYS } from "../utils/querykeys";

const seenKey = (userId: number) => `starter-modal-seen:${userId}`;

function hasSeen(userId: number): boolean {
  try {
    return window.localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markSeen(userId: number): void {
  try {
    window.localStorage.setItem(seenKey(userId), "1");
  } catch {
    // stockage indisponible : le modal reste utilisable
  }
}

/**
 * Choix du starter deck. S'ouvre tout seul une fois par compte et par appareil
 * quand le starter est disponible. `isBlocking` retient la récompense quotidienne
 * tant que le statut charge ou que le modal est ouvert.
 */
export function useStarterDeckModal(userId?: number) {
  const [isOpen, setIsOpen] = useState(false);
  // Compte pour lequel on a déjà décidé d'ouvrir (ou non) automatiquement.
  const [decidedFor, setDecidedFor] = useState<number | undefined>();

  const { data: status, isPending } = useQuery({
    queryKey: QUERY_KEYS.starterStatus,
    queryFn: () => starterDeckService.getStatus(),
    staleTime: 1000 * 60 * 5,
  });

  const available = status?.available === true;

  // Ajustement d'état pendant le rendu : une seule décision par compte.
  if (available && userId !== undefined && decidedFor !== userId) {
    setDecidedFor(userId);
    if (!hasSeen(userId)) setIsOpen(true);
  }

  useEffect(() => {
    if (isOpen && userId !== undefined) markSeen(userId);
  }, [isOpen, userId]);

  // Disponible mais compte pas encore connu : on retient la récompense quotidienne.
  const awaitingUser = available && userId === undefined;

  return {
    status,
    isOpen,
    isBlocking: isPending || awaitingUser || isOpen,
    open: () => {
      if (available) setIsOpen(true);
    },
    close: () => setIsOpen(false),
  };
}
