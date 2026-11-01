import { useEffect, useRef } from "react";
import { openEventStream } from "../api/eventStream";

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

// ── SSE privé : listing.sold → vendeur uniquement ──────────────────────────
export function useSseNotifications(
  onSold: (event: ListingSoldEvent) => void,
) {
  const onSoldRef = useRef(onSold);
  useEffect(() => {
    onSoldRef.current = onSold;
  }, [onSold]);

  useEffect(
    () =>
      openEventStream("/transactions/events", (es) => {
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
      }),
    [],
  );
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

  useEffect(
    () =>
      openEventStream("/transactions/events/new-listings", (es) => {
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
      }),
    [],
  );
}
