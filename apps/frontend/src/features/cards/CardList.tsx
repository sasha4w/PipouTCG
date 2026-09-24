import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cardService } from "../../services/card.service";
import type { Card } from "../../services/card.service";
import CardDisplay from "./CardDisplay";
import Loading from "../../components/Loading";
import { soundService } from "../../services/sound.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import "./CardList.css";

/** Laisse le temps à l'animation de chargement de s'afficher. */
const MIN_LOADING_MS = 800;

const LIMIT = 9;

interface CardListProps {
  setId: number;
  setName?: string;
  onBack?: () => void; // si undefined, pas de bouton retour
}

export default function CardList({
  setId,
  setName = `Set #${setId}`,
  onBack,
}: CardListProps) {
  const [page, setPage] = useState(1);

  const cardsQuery = useQuery({
    queryKey: QUERY_KEYS.cardsBySet(setId, page),
    queryFn: async () => {
      const minDelay = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING_MS),
      );
      const [res] = await Promise.all([
        cardService.findBySet(setId, page, LIMIT),
        minDelay,
      ]);
      return res;
    },
  });
  const cards: Card[] = cardsQuery.data?.data ?? [];
  const total = cardsQuery.data?.meta.total ?? 0;
  const totalPages = cardsQuery.data?.meta.totalPages ?? 1;
  const loading = cardsQuery.isPending;
  const error = cardsQuery.isError ? "Impossible de charger les cartes" : "";

  const handleBack = () => {
    soundService.play("cancel");
    onBack?.();
  };

  if (loading) return <Loading message={`Chargement de ${setName}...`} />;

  return (
    <div className="cardlist">
      {/* Header */}
      <div className="cardlist__header">
        {onBack && (
          <button
            className="cardlist__back"
            onClick={handleBack}
            aria-label="Retour"
          >
            <svg
              width="16px"
              height="16px"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 1H4L0 5L4 9H5V6H11C12.6569 6 14 7.34315 14 9C14 10.6569 12.6569 12 11 12H4V14H11C13.7614 14 16 11.7614 16 9C16 6.23858 13.7614 4 11 4H5V1Z"
                fill="#7a1c3b"
              />
            </svg>
          </button>
        )}
        <h2 className="cardlist__title">{setName}</h2>
        <span className="cardlist__count">
          {total} carte{total > 1 ? "s" : ""}
        </span>
      </div>

      {error && (
        <div className="cardlist__state cardlist__state--error">{error}</div>
      )}

      {!error && cards.length === 0 && (
        <div className="cardlist__state">Aucune carte dans ce set.</div>
      )}

      {cards.length > 0 && (
        <div className="cardlist__grid">
          {cards.map((card) => (
            <CardDisplay
              key={card.id}
              card={card}
              size="lg"
              interactive
              flippable
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="cardlist__pagination">
          <button
            className="cardlist__pagination-btn"
            disabled={page <= 1}
            onClick={() => {
              soundService.play("select");
              setPage((p) => p - 1);
            }}
          >
            ←
          </button>
          <span className="cardlist__pagination-info">
            {page} / {totalPages}
          </span>
          <button
            className="cardlist__pagination-btn"
            disabled={page >= totalPages}
            onClick={() => {
              soundService.play("select");
              setPage((p) => p + 1);
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
