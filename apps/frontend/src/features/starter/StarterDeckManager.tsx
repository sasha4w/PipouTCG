import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DECK_RULES,
  STARTER_FEATURED_COUNT,
  type Archetype,
  type StarterDeckCardView,
  type StarterDeckView,
} from "@pipou/shared";
import { starterDeckService } from "../../services/starterDeck.service";
import type { Card } from "../../services/card.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconMinus, IconPlus } from "../../components/Icons";
import CardFilterBar from "../glossary/CardFilterBar";
import {
  NO_FILTERS,
  matchesFilters,
  sortCards,
  useCardCatalog,
  type CardFilters,
} from "../glossary/cardCatalog";
import { STARTER_ORDER, starterTextKey } from "./starterTexts";
import "../../components/manager.css";
import "../adventure/admin/AdventureManager.css";

interface DeckSectionProps {
  deck: StarterDeckView;
  cards: Card[];
}

function DeckSection({ deck, cards }: DeckSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(deck.cards.map((c) => [c.cardId, c.quantity])),
  );
  const [featured, setFeatured] = useState<Set<number>>(
    () => new Set(deck.cards.filter((c) => c.isFeatured).map((c) => c.cardId)),
  );
  const [filters, setFilters] = useState<CardFilters>(NO_FILTERS);

  const save = useMutation({
    mutationFn: (cardsBody: StarterDeckCardView[]) =>
      starterDeckService.saveDeck(deck.archetype, { cards: cardsBody }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.adminStarterDecks,
        }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.starterStatus }),
      ]),
  });

  const total = Object.values(quantities).reduce((n, q) => n + q, 0);
  const featuredCount = featured.size;
  const inRange =
    total >= DECK_RULES.MIN_CARDS && total <= DECK_RULES.MAX_CARDS;
  const featuredOk = featuredCount === STARTER_FEATURED_COUNT;
  const name = t(`${starterTextKey(deck.archetype)}.name`);
  const visible = sortCards(
    cards.filter((c) => matchesFilters(c, filters)),
    (c) => c,
    filters,
  );

  const change = (cardId: number, delta: number) => {
    const next = Math.min(
      DECK_RULES.MAX_COPIES,
      Math.max(0, (quantities[cardId] ?? 0) + delta),
    );
    setQuantities((prev) => ({ ...prev, [cardId]: next }));
    if (next === 0) {
      setFeatured((prev) => {
        const copy = new Set(prev);
        copy.delete(cardId);
        return copy;
      });
    }
  };

  const toggleFeatured = (cardId: number) =>
    setFeatured((prev) => {
      const copy = new Set(prev);
      if (copy.has(cardId)) copy.delete(cardId);
      else copy.add(cardId);
      return copy;
    });

  const handleSave = () =>
    save.mutate(
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([cardId, quantity]) => ({
          cardId: Number(cardId),
          quantity,
          isFeatured: featured.has(Number(cardId)),
        })),
    );

  return (
    <section className="manager-form" aria-label={name}>
      <p className="manager-form__title">{name}</p>
      <p>
        {deck.isValid ? t("starter_admin.valid") : t("starter_admin.invalid")}
      </p>
      <p className={`adv-deck__total${inRange ? "" : " adv-deck__total--bad"}`}>
        {t("starter_admin.total", {
          count: total,
          min: DECK_RULES.MIN_CARDS,
          max: DECK_RULES.MAX_CARDS,
        })}
      </p>
      <p
        className={`adv-deck__total${featuredOk ? "" : " adv-deck__total--bad"}`}
      >
        {t("starter_admin.featured", {
          count: featuredCount,
          target: STARTER_FEATURED_COUNT,
        })}
      </p>
      {save.error && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(save.error) ?? t("starter_admin.error_generic")}
        </p>
      )}
      {save.isSuccess && <p role="status">{t("starter_admin.saved")}</p>}

      <CardFilterBar filters={filters} cards={cards} onChange={setFilters} />

      <div className="adv-deck__cards">
        {visible.map((card) => {
          const quantity = quantities[card.id] ?? 0;
          return (
            <div key={card.id} className="adv-deck__row">
              <span className="adv-deck__row-name">{card.name}</span>
              <input
                type="checkbox"
                aria-label={t("starter_admin.feature", { name: card.name })}
                checked={featured.has(card.id)}
                disabled={quantity === 0}
                onChange={() => toggleFeatured(card.id)}
              />
              <Button
                variant="ghost-bordeaux"
                size="icon"
                aria-label={t("starter_admin.remove", { name: card.name })}
                disabled={quantity === 0}
                onClick={() => change(card.id, -1)}
              >
                <IconMinus size={16} />
              </Button>
              <span className="adv-deck__qty">{quantity}</span>
              <Button
                variant="ghost-bordeaux"
                size="icon"
                aria-label={t("starter_admin.add", { name: card.name })}
                disabled={quantity >= DECK_RULES.MAX_COPIES}
                onClick={() => change(card.id, 1)}
              >
                <IconPlus size={16} />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="manager-form__actions">
        <Button
          className="manager-form__submit"
          disabled={save.isPending || !inRange || !featuredOk}
          onClick={handleSave}
        >
          {t("starter_admin.save")}
        </Button>
      </div>
    </section>
  );
}

export default function StarterDeckManager() {
  const { t } = useTranslation();
  const decksQuery = useQuery({
    queryKey: QUERY_KEYS.adminStarterDecks,
    queryFn: () => starterDeckService.adminList(),
  });
  const catalogQuery = useCardCatalog();

  if (decksQuery.isLoading || catalogQuery.isLoading) {
    return <Loading message={t("starter_admin.loading")} />;
  }
  if (!decksQuery.data || !catalogQuery.data) {
    return <p className="manager-error">{t("starter_admin.error")}</p>;
  }

  const byArchetype = new Map<Archetype, StarterDeckView>(
    decksQuery.data.map((d) => [d.archetype, d]),
  );

  return (
    <div className="manager">
      <h2>{t("starter_admin.title")}</h2>
      {STARTER_ORDER.map((archetype) => {
        const deck = byArchetype.get(archetype);
        if (!deck) return null;
        return (
          <DeckSection
            // Remonte la section si le serveur renvoie une autre composition.
            key={`${archetype}:${JSON.stringify(deck.cards)}`}
            deck={deck}
            cards={catalogQuery.data.data}
          />
        );
      })}
    </div>
  );
}
