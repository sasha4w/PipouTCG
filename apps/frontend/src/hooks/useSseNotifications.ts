import { useEffect, useRef } from "react";

// ── SSE privé : listing.sold → vendeur uniquement ──────────────────────────
export function useSseNotifications(onSold: (event: any) => void) {
  const onSoldRef = useRef(onSold);
  useEffect(() => {
    onSoldRef.current = onSold;
  }, [onSold]);

  useEffect(() => {
    const es = new EventSource(
      "https://tcg-backend-3lez.onrender.com/transactions/events",
      { withCredentials: true },
    );

    es.addEventListener("listing.sold", (event) => {
      try {
        const data = JSON.parse(event.data);
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
export function useSseNewListings(onUpdate: (event: any) => void) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const es = new EventSource(
      "https://tcg-backend-3lez.onrender.com/transactions/events/new-listings",
      { withCredentials: true },
    );

    es.addEventListener("market.update", (event) => {
      try {
        const data = JSON.parse(event.data);
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
