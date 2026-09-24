import { useEffect, useRef } from "react";

/** Payload de listing.sold (TransactionController, SSE privé du vendeur). */
export interface ListingSoldEvent {
  sellerId: number;
  buyerUsername: string;
  itemName: string;
  totalPrice: number;
  transactionId: number;
}

/** Payload de market.update (listing.created / cancelled / updated). */
export interface MarketUpdateEvent {
  type: string;
  transactionId?: number;
  newQuantity?: number;
  [key: string]: unknown;
}

const API_URL = import.meta.env.VITE_API_URL;

// ── SSE privé : listing.sold → vendeur uniquement ──────────────────────────
export function useSseNotifications(
  onSold: (event: ListingSoldEvent) => void,
) {
  const onSoldRef = useRef(onSold);
  useEffect(() => {
    onSoldRef.current = onSold;
  }, [onSold]);

  useEffect(() => {
    const es = new EventSource(
      `${API_URL}/transactions/events`,
      { withCredentials: true },
    );

    es.addEventListener("listing.sold", (event) => {
      try {
        const data = JSON.parse(event.data as string) as ListingSoldEvent;
        onSoldRef.current(data);
      } catch (e) {
        console.error("Erreur de parsing SSE listing.sold", e);
      }
    });

    es.onerror = (err) => {
      console.error("SSE listing.sold disconnected", err);
    };

    return () => es.close();
  }, []);
}

// ── SSE public : market.update → tout le monde ────────────────────────────
// Reçoit les events listing.created et listing.cancelled
export function useSseNewListings(
  onUpdate: (event: MarketUpdateEvent) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const es = new EventSource(
      `${API_URL}/transactions/events/new-listings`,
      { withCredentials: true },
    );

    es.addEventListener("market.update", (event) => {
      try {
        const data = JSON.parse(event.data as string) as MarketUpdateEvent;
        onUpdateRef.current(data);
      } catch (e) {
        console.error("Erreur de parsing SSE market.update", e);
      }
    });

    es.onerror = (err) => {
      console.error("SSE market.update disconnected", err);
    };

    return () => es.close();
  }, []);
}
