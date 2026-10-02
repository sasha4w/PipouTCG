import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deckService } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import Button from "../../components/Button";
import "./DeckWidget.css";

interface DeckWidgetProps {
  onSelectDeck?: (deckId: number) => void;
  selectedDeckId?: number;
}

export default function DeckWidget({
  onSelectDeck,
  selectedDeckId,
}: DeckWidgetProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: decks = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
    enabled: open,
  });

  return (
    <div className="dw-container">
      <Button
        variant="ghost-bordeaux"
        onClick={() => setOpen((o) => !o)}
        className="dw-trigger"
        title="Mes decks"
      >
        <span className="dw-trigger-icon">🃏</span>
        <span className="dw-trigger-label">Decks</span>
        <span className={`dw-chevron${open ? " dw-chevron--open" : ""}`}>
          ▾
        </span>
      </Button>

      {open && (
        <div className="dw-panel">
          <div className="dw-panel-header">
            <span className="dw-panel-title">🃏 Mes Decks</span>
            <Button
              variant="ghost-bordeaux"
              size="sm"
              onClick={() => {
                setOpen(false);
                navigate("/decks");
              }}
            >
              Gérer
            </Button>
          </div>

          {isLoading ? (
            <p className="dw-muted">Chargement…</p>
          ) : decks.length === 0 ? (
            <div className="dw-empty">
              <p className="dw-muted">Aucun deck</p>
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  navigate("/decks");
                }}
              >
                + Créer un deck
              </Button>
            </div>
          ) : (
            <ul className="dw-list">
              {decks.map((deck) => {
                const total = deck.deckCards.reduce(
                  (acc, dc) => acc + dc.quantity,
                  0,
                );
                const selected = deck.id === selectedDeckId;
                return (
                  <li
                    key={deck.id}
                    className={`dw-item${selected ? " dw-item--selected" : ""}`}
                  >
                    <div className="dw-item-info">
                      <span className="dw-item-name">{deck.name}</span>
                      <span className="dw-item-count">{total} cartes</span>
                    </div>
                    {onSelectDeck && (
                      <Button
                        variant="ghost-bordeaux"
                        size="sm"
                        active={selected}
                        onClick={() => {
                          if (!selected) {
                            onSelectDeck(deck.id);
                            setOpen(false);
                          }
                        }}
                      >
                        {selected ? "✓ Sélectionné" : "Utiliser"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
