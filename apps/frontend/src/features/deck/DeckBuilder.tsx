import { useEffect, useState } from "react";
import {
  deckService,
  type Deck,
  type DeckCardEntry,
} from "../../services/deck.service";
import { userService } from "../../services/user.service";
import "../../components/manager.css";
import "./DeckBuilder.css";

type View = "list" | "editor";

export default function DeckBuilder() {
  const [view, setView] = useState<View>("list");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCards, setInventoryCards] = useState<any[]>([]);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [deckName, setDeckName] = useState("");
  const [cards, setCards] = useState<DeckCardEntry[]>([]);
  const [search, setSearch] = useState("");

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
    setView("editor");
  };

  const back = () => {
    setView("list");
    setEditing(null);
  };

  // ─── CARTE MAP (une seule fois, indexée par userCardId) ───
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

      const found = prev.find((c) => c.userCardId === userCardId);
      if (found) {
        if (found.quantity >= 3) return prev;
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
      <div className="manager__header">
        <button onClick={back} className="manager-form__cancel">
          ← Retour
        </button>
        <h2 className="manager__title">
          {editing ? "Modifier le deck" : "Créer un deck"}
        </h2>
      </div>

      <div className="deck-layout">
        {/* LEFT — Inventaire */}
        <div className="deck-panel">
          <div className="deck-panel__header">
            <h3>Inventaire</h3>
            <span className="deck-panel__count">{allCards.length} cartes</span>
          </div>

          <input
            className="deck-search"
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="deck-inventory-list">
            {allCards.map((c) => {
              const inDeck = cards.find((x) => x.userCardId === c.userCardId);
              const atMax = inDeck && inDeck.quantity >= 3;
              const deckFull = totalCards >= 40;

              return (
                <div key={c.userCardId} className="deck-card-row">
                  <div className="deck-card-row__info">
                    <span
                      className="deck-card-row__dot"
                      style={{ background: rarityColor[c.rarity] ?? "#ccc" }}
                    />
                    <span className="deck-card-row__name">{c.name}</span>
                    <span className="deck-card-row__stock">x{c.quantity}</span>
                  </div>
                  <div className="deck-card-row__actions">
                    {inDeck && (
                      <span className="deck-card-row__qty">
                        x{inDeck.quantity}
                      </span>
                    )}
                    <button
                      className="deck-icon-btn deck-icon-btn--add"
                      onClick={() => addCard(c.userCardId)}
                      disabled={atMax || deckFull}
                      title={
                        atMax
                          ? "Maximum 3 exemplaires"
                          : deckFull
                            ? "Deck plein"
                            : "Ajouter"
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Deck */}
        <div className="deck-panel deck-panel--right">
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Nom du deck"
            className="manager-form__input"
          />

          <div className="deck-counter-bar">
            <div
              className="deck-counter-fill"
              style={{ width: `${Math.min((totalCards / 40) * 100, 100)}%` }}
            />
          </div>
          <div className="deck-counter">
            <span className={totalCards > 40 ? "deck-counter--over" : ""}>
              {totalCards}
            </span>
            <span> / 40</span>
            {!isValid && totalCards > 0 && (
              <span className="deck-counter--hint">
                {totalCards < 20 ? ` (min 20)` : ` (max 40)`}
              </span>
            )}
          </div>

          <div className="deck-list">
            {cards.length === 0 ? (
              <p className="deck-list--empty">
                Ajoute des cartes depuis l'inventaire →
              </p>
            ) : (
              cards.map((c) => {
                const info = allCardsMap.get(c.userCardId);
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
                        disabled={c.quantity >= 3 || totalCards >= 40}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={save}
            disabled={!isValid || !deckName.trim()}
            className="manager-form__submit deck-save-btn"
          >
            {isValid
              ? "💾 Sauvegarder"
              : `⚠ ${totalCards < 20 ? `Encore ${20 - totalCards} cartes` : "Trop de cartes"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
