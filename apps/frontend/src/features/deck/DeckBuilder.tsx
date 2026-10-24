import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DECK_RULES } from "@pipou/shared";
import {
  deckService,
  type CardInDeck,
  type Deck,
  type DeckCardEntry,
} from "../../services/deck.service";
import { userService } from "../../services/user.service";
import { soundService } from "../../services/sound.service";
import type { Card } from "../../services/card.service";
import CardFace from "../cards/CardFace";
import CardInspect from "../fight/CardInspect";
import CardFilterBar from "../glossary/CardFilterBar";
import CardEffectsText from "../glossary/CardEffectsText";
import {
  NO_FILTERS,
  cardKind,
  matchesFilters,
  shortSetName,
  sortCards,
  useCardCatalog,
} from "../glossary/cardCatalog";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import {
  IconArrowLeft,
  IconCards,
  IconMinus,
  IconPencil,
  IconPlus,
  IconTrash,
} from "../../components/Icons";
import "../../components/manager.css";
import { QUERY_KEYS } from "../../utils/querykeys";
import "./DeckBuilder.css";

type View = "list" | "editor";

/** Carte proposée dans l'éditeur : issue de l'inventaire ou du deck édité. */
type PickableCard = CardInDeck & {
  userCardId: number;
  quantity: number;
  set?: string;
  setId?: number;
};

const NO_DECKS: Deck[] = [];
const NO_CARDS: PickableCard[] = [];
const NO_CATALOG: Card[] = [];

/** Repli quand la carte manque au catalogue : sans effets. */
function toCard(c: PickableCard): Card {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    supportType: c.supportType ?? null,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    description: c.description ?? undefined,
    image: c.image ?? null,
    cardSet: { id: c.setId ?? 0, name: c.set ?? "" },
  };
}

function maxCopies(c: PickableCard): number {
  return Math.min(DECK_RULES.MAX_COPIES, c.quantity);
}

export default function DeckBuilder() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("list");
  const queryClient = useQueryClient();
  const decksQuery = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
  });
  const inventoryQuery = useQuery({
    queryKey: QUERY_KEYS.inventory,
    queryFn: () => userService.getMyInventory(),
  });
  const catalogQuery = useCardCatalog();
  const decks = decksQuery.data ?? NO_DECKS;
  const inventoryCards: PickableCard[] =
    inventoryQuery.data?.cards.data ?? NO_CARDS;
  const catalog = catalogQuery.data?.data ?? NO_CATALOG;
  const loading = decksQuery.isPending || inventoryQuery.isPending;
  const [editing, setEditing] = useState<Deck | null>(null);
  const [deckName, setDeckName] = useState("");
  const [cards, setCards] = useState<DeckCardEntry[]>([]);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [inspected, setInspected] = useState<Card | null>(null);

  const refreshDecks = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.decks });

  // ─── NAV ──────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setDeckName("");
    setCards([]);
    setFilters(NO_FILTERS);
    setView("editor");
  };

  const openEdit = (deck: Deck) => {
    setEditing(deck);
    setDeckName(deck.name);
    setCards(
      deck.deckCards.map((dc) => ({
        userCardId: dc.userCard.id,
        quantity: dc.quantity,
      })),
    );
    setFilters(NO_FILTERS);
    setView("editor");
  };

  const back = () => {
    setView("list");
    setEditing(null);
  };

  // ─── CARTE MAP ────────────────────────────────
  const allCardsMap = new Map<number, PickableCard>();
  inventoryCards.forEach((c) => allCardsMap.set(c.userCardId, c));
  editing?.deckCards.forEach((dc) => {
    if (!allCardsMap.has(dc.userCard.id)) {
      allCardsMap.set(dc.userCard.id, {
        ...dc.userCard.card,
        userCardId: dc.userCard.id,
        quantity: dc.userCard.quantity,
      });
    }
  });

  // L'inventaire n'a pas les effets : on les prend dans le catalogue.
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const fullCard = (c: PickableCard): Card =>
    catalogById.get(c.id) ?? toCard(c);

  const owned = Array.from(allCardsMap.values());
  const ownedCards = owned.map(fullCard);
  const visible = sortCards(
    owned.filter((c) => matchesFilters(fullCard(c), filters)),
    fullCard,
    filters,
  );

  const deckCards = cards
    .flatMap((entry) => {
      const info = allCardsMap.get(entry.userCardId);
      return info ? [{ ...entry, info }] : [];
    })
    .sort(
      (a, b) =>
        a.info.cost - b.info.cost || a.info.name.localeCompare(b.info.name),
    );

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const deckFull = totalCards >= DECK_RULES.MAX_CARDS;
  const isValid =
    totalCards >= DECK_RULES.MIN_CARDS && totalCards <= DECK_RULES.MAX_CARDS;

  // ─── LOGIC CARTES ─────────────────────────────
  const addCard = (userCardId: number) => {
    setCards((prev) => {
      const total = prev.reduce((s, c) => s + c.quantity, 0);
      if (total >= DECK_RULES.MAX_CARDS) return prev;
      const inventoryCard = allCardsMap.get(userCardId);
      const maxAllowed = inventoryCard ? maxCopies(inventoryCard) : 0;
      const found = prev.find((c) => c.userCardId === userCardId);
      if (found) {
        if (found.quantity >= maxAllowed) return prev;
        return prev.map((c) =>
          c.userCardId === userCardId ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      if (maxAllowed === 0) return prev;
      return [...prev, { userCardId, quantity: 1 }];
    });
  };

  const removeCard = (userCardId: number) => {
    setCards((prev) =>
      prev
        .map((c) =>
          c.userCardId === userCardId ? { ...c, quantity: c.quantity - 1 } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const inspect = (card: Card) => {
    soundService.play("select");
    setInspected(card);
  };

  // ─── SAVE ─────────────────────────────────────
  const save = async () => {
    if (!deckName.trim()) return;
    const body = { name: deckName, cards };
    if (editing) await deckService.updateDeck(editing.id, body);
    else await deckService.createDeck(body);
    back();
    void refreshDecks();
  };

  const removeDeck = async (id: number) => {
    if (!confirm(t("deck.confirmDelete"))) return;
    await deckService.deleteDeck(id);
    void refreshDecks();
  };

  // ═════════════════ LIST ═════════════════
  if (view === "list") {
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">{t("deck.title")}</h2>
          <Button size="sm" onClick={openCreate}>
            {t("deck.new")}
          </Button>
        </div>

        {loading ? (
          <p className="manager-empty">{t("deck.loading")}</p>
        ) : decks.length === 0 ? (
          <div className="deck-empty-state">
            <IconCards size={48} className="deck-empty-icon" />
            <p>{t("deck.none")}</p>
            <span>{t("deck.noneHint")}</span>
          </div>
        ) : (
          <div className="manager-list">
            {decks.map((d) => {
              const total = d.deckCards.reduce((s, c) => s + c.quantity, 0);
              const isValidDeck =
                total >= DECK_RULES.MIN_CARDS && total <= DECK_RULES.MAX_CARDS;
              return (
                <div key={d.id} className="manager-item deck-item">
                  <div className="manager-item__info">
                    <div className="manager-item__name">{d.name}</div>
                    <div className="deck-item__meta">
                      <span
                        className={`deck-badge ${isValidDeck ? "deck-badge--valid" : "deck-badge--invalid"}`}
                      >
                        {t("deck.cardCount", {
                          count: total,
                          max: DECK_RULES.MAX_CARDS,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="manager-item__actions">
                    <Button
                      variant="ghost-bordeaux"
                      size="icon"
                      aria-label={t("deck.edit")}
                      onClick={() => openEdit(d)}
                    >
                      <IconPencil size={16} />
                    </Button>
                    <Button
                      variant="danger"
                      size="icon"
                      aria-label={t("deck.delete")}
                      onClick={() => removeDeck(d.id)}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═════════════════ EDITOR ═════════════════
  if (catalogQuery.isPending)
    return <Loading message={t("glossary.loading")} />;

  return (
    <div className="manager deck-editor">
      {/* Header */}
      <div className="manager__header deck-editor__topbar">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          aria-label={t("deck.back")}
          onClick={back}
        >
          <IconArrowLeft size={16} />
        </Button>
        <input
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder={t("deck.name")}
          aria-label={t("deck.name")}
          className="manager-form__input deck-editor__name-input"
        />
      </div>

      {/* Bandeau du deck */}
      <section className="deck-strip" aria-label={t("deck.mine")}>
        <div className="deck-strip__label">
          {t("deck.mine")} · {totalCards} / {DECK_RULES.MAX_CARDS}
        </div>
        {deckCards.length === 0 ? (
          <p className="deck-strip__empty">{t("deck.stripEmpty")}</p>
        ) : (
          <ul className="deck-strip__list">
            {deckCards.map(({ userCardId, quantity, info }) => (
              <li key={userCardId}>
                <button
                  type="button"
                  className="deck-strip__card"
                  aria-label={t("deck.viewQty", {
                    name: info.name,
                    qty: quantity,
                  })}
                  onClick={() => inspect(fullCard(info))}
                >
                  <CardFace card={fullCard(info)} size="xs" />
                  <span className="deck-strip__qty">{quantity}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Collection */}
      <div className="deck-tab-content">
        <CardFilterBar
          filters={filters}
          cards={ownedCards}
          onChange={setFilters}
        />

        {visible.length === 0 && (
          <div className="cg__state">
            {owned.length === 0
              ? t("deck.collectionEmpty")
              : t("glossary.empty")}
          </div>
        )}

        <ul className="cg__list">
          {visible.map((c) => {
            const card = fullCard(c);
            const inDeckQty =
              cards.find((x) => x.userCardId === c.userCardId)?.quantity ?? 0;
            return (
              <li
                key={c.userCardId}
                className={`deck-row${inDeckQty > 0 ? " deck-row--in" : ""}`}
              >
                <button
                  type="button"
                  className="deck-row__main"
                  aria-label={t("glossary.view", { name: card.name })}
                  onClick={() => inspect(card)}
                >
                  <div className="cg__thumb">
                    <CardFace card={card} size="xs" />
                  </div>
                  <div className="cg__body">
                    <div className="cg__name">{card.name}</div>
                    <div className="cg__meta">
                      {t(`glossary.kind.${cardKind(card)}`)} ·{" "}
                      {shortSetName(card.cardSet.name)}
                    </div>
                    <CardEffectsText card={card} />
                  </div>
                </button>
                <div className="deck-row__qty">
                  <Button
                    variant="ghost-bordeaux"
                    size="icon"
                    aria-label={t("deck.add", { name: card.name })}
                    onClick={() => addCard(c.userCardId)}
                    disabled={inDeckQty >= maxCopies(c) || deckFull}
                  >
                    <IconPlus size={14} />
                  </Button>
                  <span className="deck-row__count">{inDeckQty}</span>
                  <span className="deck-row__owned">
                    {t("deck.owned", { count: c.quantity })}
                  </span>
                  <Button
                    variant="ghost-bordeaux"
                    size="icon"
                    aria-label={t("deck.remove", { name: card.name })}
                    onClick={() => removeCard(c.userCardId)}
                    disabled={inDeckQty === 0}
                  >
                    <IconMinus size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Barre sticky bottom */}
      <div className="deck-bottom-bar">
        <div className="deck-counter-bar">
          <div
            className="deck-counter-fill"
            style={{
              width: `${Math.min((totalCards / DECK_RULES.MAX_CARDS) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="deck-bottom-bar__row">
          <span
            className={`deck-counter ${totalCards > DECK_RULES.MAX_CARDS ? "deck-counter--over" : ""}`}
          >
            {totalCards} / {DECK_RULES.MAX_CARDS}
            {!isValid && totalCards > 0 && (
              <span className="deck-counter--hint">
                {totalCards < DECK_RULES.MIN_CARDS
                  ? t("deck.remaining", {
                      count: DECK_RULES.MIN_CARDS - totalCards,
                    })
                  : t("deck.tooMany")}
              </span>
            )}
          </span>
          <Button
            onClick={save}
            disabled={!isValid || !deckName.trim()}
            className="deck-save-btn"
          >
            {t("deck.save")}
          </Button>
        </div>
      </div>

      {inspected && (
        <CardInspect card={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
