import { useEffect, useState } from "react";
import {
  deckService,
  type Deck,
  type DeckCardEntry,
} from "../../services/deck.service";
import { userService } from "../../services/user.service";
import type { Card } from "../../services/card.service";
import CardDisplay from "../cards/CardDisplay";
import "../../components/manager.css";
import "./DeckBuilder.css";

type View = "list" | "editor";

function toCard(c: any): Card {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    supportType: c.supportType ?? null,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    description: c.description,
    image: c.image ?? null,
    cardSet: { id: c.setId ?? 0, name: c.set ?? "" },
  };
}

export default function DeckBuilder() {
  const [view, setView] = useState<View>("list");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCards, setInventoryCards] = useState<any[]>([]);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [deckName, setDeckName] = useState("");
  const [cards, setCards] = useState<DeckCardEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [tab, setTab] = useState<"inventory" | "deck">("inventory");

  // ─── LOAD ─────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [d, inv] = await Promise.all([
        deckService.getMyDecks(),
        userService.getMyInventory(),
      ]);
      setDecks(d);
      setInventoryCards(inv.cards.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ─── NAV ──────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setDeckName("");
    setCards([]);
    setSearch("");
    setTab("inventory");
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
    setSearch("");
    setTab("inventory");
    setView("editor");
  };

  const back = () => {
    setView("list");
    setEditing(null);
  };

  // ─── CARTE MAP ────────────────────────────────
  const allCardsMap = new Map<number, any>();
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

  const allCards = Array.from(allCardsMap.values()).filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const isValid = totalCards >= 20 && totalCards <= 40;

  // ─── LOGIC CARTES ─────────────────────────────
  const addCard = (userCardId: number) => {
    setCards((prev) => {
      const total = prev.reduce((s, c) => s + c.quantity, 0);
      if (total >= 40) return prev;
      const inventoryCard = allCardsMap.get(userCardId);
      const maxAllowed = Math.min(3, inventoryCard?.quantity ?? 0);
      const found = prev.find((c) => c.userCardId === userCardId);
      if (found) {
        if (found.quantity >= maxAllowed) return prev;
        return prev.map((c) =>
          c.userCardId === userCardId ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
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

  // ─── SAVE ─────────────────────────────────────
  const save = async () => {
    if (!deckName.trim()) return;
    const body = { name: deckName, cards };
    if (editing) await deckService.updateDeck(editing.id, body);
    else await deckService.createDeck(body);
    back();
    load();
  };

  const removeDeck = async (id: number) => {
    if (!confirm("Supprimer ce deck ?")) return;
    await deckService.deleteDeck(id);
    load();
  };

  const rarityColor: Record<string, string> = {
    common: "#9e9e9e",
    uncommon: "#4caf50",
    rare: "#2196f3",
    epic: "#9c27b0",
    legendary: "#ff9800",
    secret: "#f44336",
  };

  // ─── MODAL CARTE ──────────────────────────────
  const CardModal = () => {
    if (!selectedCard) return null;
    const c = selectedCard;
    const inDeck = cards.find((x) => x.userCardId === c.userCardId);
    const maxAllowed = Math.min(3, c.quantity);
    const atMax = inDeck ? inDeck.quantity >= maxAllowed : false;
    const deckFull = totalCards >= 40;
    const inDeckQty = inDeck?.quantity ?? 0;

    return (
      <div className="deck-modal-overlay" onClick={() => setSelectedCard(null)}>
        <div className="deck-modal" onClick={(e) => e.stopPropagation()}>
          <button
            className="deck-modal-close"
            onClick={() => setSelectedCard(null)}
          >
            ✕
          </button>

          <div className="deck-modal-card">
            <CardDisplay
              card={toCard(c)}
              size="md"
              interactive={true}
              flippable={true}
            />
          </div>

          <div className="deck-modal-info">
            <div className="deck-modal-stock">
              Possédé : <strong>x{c.quantity}</strong>
            </div>
          </div>

          <div className="deck-modal-controls">
            <button
              className="deck-modal-btn deck-modal-btn--remove"
              onClick={() => removeCard(c.userCardId)}
              disabled={!inDeck}
            >
              −
            </button>
            <div className="deck-modal-qty">
              <span className="deck-modal-qty-num">{inDeckQty}</span>
              <span className="deck-modal-qty-label">dans le deck</span>
            </div>
            <button
              className="deck-modal-btn deck-modal-btn--add"
              onClick={() => addCard(c.userCardId)}
              disabled={atMax || deckFull}
            >
              +
            </button>
          </div>

          {(atMax || deckFull) && (
            <p className="deck-modal-hint">
              {deckFull
                ? "Deck plein (40 cartes)"
                : `Maximum ${maxAllowed} exemplaire${maxAllowed > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ═════════════════ LIST ═════════════════
  if (view === "list") {
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Mes Decks</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouveau
          </button>
        </div>

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : decks.length === 0 ? (
          <div className="deck-empty-state">
            <div className="deck-empty-icon">🃏</div>
            <p>Aucun deck créé</p>
            <span>Construis ton premier deck !</span>
          </div>
        ) : (
          <div className="manager-list">
            {decks.map((d) => {
              const total = d.deckCards.reduce((s, c) => s + c.quantity, 0);
              const isValidDeck = total >= 20 && total <= 40;
              return (
                <div key={d.id} className="manager-item deck-item">
                  <div className="manager-item__info">
                    <div className="manager-item__name">{d.name}</div>
                    <div className="deck-item__meta">
                      <span
                        className={`deck-badge ${isValidDeck ? "deck-badge--valid" : "deck-badge--invalid"}`}
                      >
                        {total} / 40 cartes
                      </span>
                    </div>
                  </div>
                  <div className="manager-item__actions">
                    <button
                      className="deck-btn deck-btn--edit"
                      onClick={() => openEdit(d)}
                    >
                      ✏
                    </button>
                    <button
                      className="deck-btn deck-btn--delete"
                      onClick={() => removeDeck(d.id)}
                    >
                      🗑
                    </button>
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
  return (
    <div className="manager deck-editor">
      <CardModal />

      {/* Header */}
      <div className="manager__header deck-editor__topbar">
        <button onClick={back} className="manager-form__cancel">
          ← Retour
        </button>
        <input
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder="Nom du deck"
          className="manager-form__input deck-editor__name-input"
        />
      </div>

      {/* Onglets */}
      <div className="deck-tabs">
        <button
          className={`deck-tab ${tab === "inventory" ? "deck-tab--active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventaire
          <span className="deck-tab__badge">{allCards.length}</span>
        </button>
        <button
          className={`deck-tab ${tab === "deck" ? "deck-tab--active" : ""}`}
          onClick={() => setTab("deck")}
        >
          Mon deck
          <span
            className={`deck-tab__badge ${totalCards > 0 ? "deck-tab__badge--filled" : ""}`}
          >
            {totalCards}/40
          </span>
        </button>
      </div>

      {/* Contenu scrollable */}
      <div className="deck-tab-content">
        {tab === "inventory" ? (
          <>
            <input
              className="deck-search"
              placeholder="🔍 Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="deck-inventory-grid">
              {allCards.map((c) => {
                const inDeck = cards.find((x) => x.userCardId === c.userCardId);
                const inDeckQty = inDeck?.quantity ?? 0;
                return (
                  <div
                    key={c.userCardId}
                    className="deck-inv-card"
                    onClick={() => setSelectedCard(c)}
                  >
                    <CardDisplay
                      card={toCard(c)}
                      size="sm"
                      interactive={false}
                      flippable={false}
                    />
                    <span className="deck-inv-stock">x{c.quantity}</span>
                    {inDeck && (
                      <span className="deck-inv-in-deck">✓{inDeckQty}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="deck-list-tab">
            {cards.length === 0 ? (
              <p className="deck-list--empty">
                Va dans l'inventaire pour ajouter des cartes
              </p>
            ) : (
              cards.map((c) => {
                const info = allCardsMap.get(c.userCardId);
                const maxAllowed = Math.min(
                  3,
                  allCardsMap.get(c.userCardId)?.quantity ?? 0,
                );
                return (
                  <div key={c.userCardId} className="deck-row">
                    <div className="deck-row__info">
                      <span
                        className="deck-card-row__dot"
                        style={{
                          background: rarityColor[info?.rarity] ?? "#ccc",
                        }}
                      />
                      <span className="deck-row__name">
                        {info?.name ?? `Carte #${c.userCardId}`}
                      </span>
                    </div>
                    <div className="deck-row__controls">
                      <button
                        className="deck-icon-btn deck-icon-btn--remove"
                        onClick={() => removeCard(c.userCardId)}
                      >
                        −
                      </button>
                      <span className="deck-row__qty">x{c.quantity}</span>
                      <button
                        className="deck-icon-btn deck-icon-btn--add"
                        onClick={() => addCard(c.userCardId)}
                        disabled={c.quantity >= maxAllowed || totalCards >= 40}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Barre sticky bottom */}
      <div className="deck-bottom-bar">
        <div className="deck-counter-bar">
          <div
            className="deck-counter-fill"
            style={{ width: `${Math.min((totalCards / 40) * 100, 100)}%` }}
          />
        </div>
        <div className="deck-bottom-bar__row">
          <span
            className={`deck-counter ${totalCards > 40 ? "deck-counter--over" : ""}`}
          >
            {totalCards} / 40
            {!isValid && totalCards > 0 && (
              <span className="deck-counter--hint">
                {totalCards < 20
                  ? ` · encore ${20 - totalCards}`
                  : ` · trop de cartes`}
              </span>
            )}
          </span>
          <button
            onClick={save}
            disabled={!isValid || !deckName.trim()}
            className="manager-form__submit deck-save-btn"
          >
            {isValid ? "💾 Sauvegarder" : "⚠ Invalide"}
          </button>
        </div>
      </div>
    </div>
  );
}
