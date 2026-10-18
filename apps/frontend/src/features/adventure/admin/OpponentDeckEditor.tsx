import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DECK_RULES, type AdminAdventureOpponent } from "@pipou/shared";
import { adventureService } from "../../../services/adventure.service";
import type { Card } from "../../../services/card.service";
import { apiErrorMessage } from "../../../utils/errors";
import Button from "../../../components/Button";
import { IconMinus, IconPlus } from "../../../components/Icons";
import { useAdminAdventureMutation } from "./useAdminAdventureMutation";
import "../../../components/manager.css";
import "./AdventureManager.css";

interface Props {
  opponent: AdminAdventureOpponent;
  /** Cartes du set du monde : seules autorisées dans le deck. */
  cards: Card[];
  onDone: () => void;
}

export default function OpponentDeckEditor({ opponent, cards, onDone }: Props) {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(opponent.deck.map((c) => [c.cardId, c.quantity])),
  );

  const save = useAdminAdventureMutation(
    (body: { cards: { cardId: number; quantity: number }[] }) =>
      adventureService.saveDeck(opponent.id, body),
    onDone,
  );
  const regenerate = useAdminAdventureMutation(
    () => adventureService.regenerateDeck(opponent.id),
    onDone,
  );

  const total = Object.values(quantities).reduce((n, q) => n + q, 0);
  const inRange = total >= DECK_RULES.MIN_CARDS && total <= DECK_RULES.MAX_CARDS;
  const busy = save.isPending || regenerate.isPending;
  const mutationError = save.error ?? regenerate.error;

  const change = (cardId: number, delta: number) =>
    setQuantities((prev) => {
      const next = Math.min(
        DECK_RULES.MAX_COPIES,
        Math.max(0, (prev[cardId] ?? 0) + delta),
      );
      return { ...prev, [cardId]: next };
    });

  const handleSave = () =>
    save.mutate({
      cards: Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([cardId, quantity]) => ({ cardId: Number(cardId), quantity })),
    });

  const handleRegenerate = () => {
    if (!window.confirm(t("adventure_admin.deck.regenerate_confirm"))) return;
    regenerate.mutate(undefined);
  };

  const rangeParams = { min: DECK_RULES.MIN_CARDS, max: DECK_RULES.MAX_CARDS };

  return (
    <div className="manager-form">
      <p className="manager-form__title">
        {t("adventure_admin.deck.title", { name: opponent.name })}
      </p>
      <p className={`adv-deck__total${inRange ? "" : " adv-deck__total--bad"}`}>
        {t("adventure_admin.deck.total", { count: total, ...rangeParams })}
      </p>
      {!inRange && (
        <p className="manager-error" role="alert">
          {t("adventure_admin.deck.range_error", rangeParams)}
        </p>
      )}
      {mutationError && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(mutationError) ?? t("adventure_admin.error_generic")}
        </p>
      )}

      {cards.length === 0 ? (
        <p className="manager-empty">{t("adventure_admin.deck.no_cards")}</p>
      ) : (
        <div className="adv-deck__cards">
          {cards.map((card) => {
            const quantity = quantities[card.id] ?? 0;
            return (
              <div key={card.id} className="adv-deck__row">
                <span className="adv-deck__row-name">{card.name}</span>
                <Button
                  variant="ghost-bordeaux"
                  size="icon"
                  aria-label={t("adventure_admin.deck.remove", { name: card.name })}
                  disabled={quantity === 0}
                  onClick={() => change(card.id, -1)}
                >
                  <IconMinus size={16} />
                </Button>
                <span className="adv-deck__qty">{quantity}</span>
                <Button
                  variant="ghost-bordeaux"
                  size="icon"
                  aria-label={t("adventure_admin.deck.add", { name: card.name })}
                  disabled={quantity >= DECK_RULES.MAX_COPIES}
                  onClick={() => change(card.id, 1)}
                >
                  <IconPlus size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="manager-form__actions">
        <Button variant="danger" disabled={busy} onClick={handleRegenerate}>
          {t("adventure_admin.deck.regenerate")}
        </Button>
        <Button
          className="manager-form__submit"
          disabled={busy || !inRange}
          onClick={handleSave}
        >
          {t("adventure_admin.deck.save")}
        </Button>
      </div>
    </div>
  );
}
