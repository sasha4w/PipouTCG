import { useEffect, useRef } from "react";

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
        console.error("Erreur de parsing SSE", e);
      }
    });

    es.onerror = (err) => {
      console.error("SSE disconnected", err);
    };

    return () => es.close();
  }, []);
}
