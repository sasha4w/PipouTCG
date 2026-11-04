import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { deckService, type Deck } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import Button from "../../components/Button";
import { IconCards, IconStar } from "../../components/Icons";
import CardFace from "../cards/CardFace";
import {
  cardFromDeck,
  coverCard,
  deckTotal,
  defaultDeck,
  isPlayable,
  lastUsedDeckId,
  sortDecks,
} from "./deckPicker";
import { useToggleFavorite } from "./useToggleFavorite";
import "./DeckWidget.css";

interface DeckWidgetProps {
  onSelectDeck?: (deckId: number) => void;
  selectedDeckId?: number;
}

const NO_DECKS: Deck[] = [];

export default function DeckWidget({
  onSelectDeck,
  selectedDeckId,
}: DeckWidgetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const toggleFavorite = useToggleFavorite();
  const sentId = useRef<number | null>(null);

  const { data: decks = NO_DECKS, isPending } = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
  });
  const playable = decks.filter(isPlayable);
  const hidden = decks.length - playable.length;
  const selected = playable.find((d) => d.id === selectedDeckId) ?? null;
  const fallback = defaultDeck(playable);
  const lastId = lastUsedDeckId(playable);
  const fallbackId = fallback?.id ?? null;

  // Pas de choix (ou deck devenu injouable) : on prend le deck par défaut,
  // une seule fois par id pour ne pas boucler si le parent ne suit pas.
  useEffect(() => {
    if (selected) {
      sentId.current = null;
      return;
    }
    if (fallbackId === null || !onSelectDeck) return;
    if (sentId.current === fallbackId) return;
    sentId.current = fallbackId;
    onSelectDeck(fallbackId);
  }, [selected, fallbackId, onSelectDeck]);

  const manage = () => navigate("/decks");

  if (isPending) return <p className="dw-muted">{t("deckPicker.loading")}</p>;

  if (playable.length === 0)
    return (
      <div className="dw-empty">
        <p className="dw-muted">{t("deckPicker.none")}</p>
        <Button size="sm" className="dw-btn" onClick={manage}>
          {t("deckPicker.complete")}
        </Button>
      </div>
    );

  const shown = selected ?? fallback;
  const cover = shown ? coverCard(shown) : null;

  return (
    <div className="dw">
      {shown && (
        <div className="dw-current">
          <div className="dw-cover">
            {cover ? (
              <CardFace card={cardFromDeck(cover)} size="xs" />
            ) : (
              <IconCards size={28} />
            )}
          </div>
          <div className="dw-current__info">
            <span className="dw-current__name">
              {shown.isFavorite && (
                <IconStar size={14} className="dw-star dw-star--on" />
              )}
              {shown.name}
            </span>
            <span className="dw-muted">
              {t("deckPicker.cards", { count: deckTotal(shown) })}
              {shown.id === lastId && ` · ${t("deckPicker.lastUsed")}`}
            </span>
          </div>
          <Button
            variant="ghost-bordeaux"
            size="sm"
            className="dw-btn"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? t("deckPicker.close") : t("deckPicker.change")}
          </Button>
        </div>
      )}

      {open && (
        <div className="dw-panel">
          <ul className="dw-list" role="listbox">
            {sortDecks(playable).map((deck) => (
              <li key={deck.id} className="dw-item">
                <button
                  type="button"
                  className="dw-fav"
                  aria-label={t(
                    deck.isFavorite
                      ? "deckPicker.unfavorite"
                      : "deckPicker.favorite",
                    { name: deck.name },
                  )}
                  aria-pressed={deck.isFavorite}
                  onClick={() => toggleFavorite(deck)}
                >
                  <IconStar
                    size={18}
                    className={`dw-star${deck.isFavorite ? " dw-star--on" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={deck.id === shown?.id}
                  className={`dw-pick${deck.id === shown?.id ? " dw-pick--selected" : ""}`}
                  onClick={() => {
                    onSelectDeck?.(deck.id);
                    setOpen(false);
                  }}
                >
                  <span className="dw-item-name">{deck.name}</span>
                  <span className="dw-muted">
                    {t("deckPicker.cards", { count: deckTotal(deck) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button type="button" className="dw-hidden" onClick={manage}>
              {t("deckPicker.hidden", { count: hidden })} ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
