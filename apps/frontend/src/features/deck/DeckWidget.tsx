import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deckService } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";

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
    <div style={s.container}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={s.trigger}
        title="Mes decks"
      >
        <span style={s.triggerIcon}>🃏</span>
        <span style={s.triggerLabel}>Decks</span>
        <span
          style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>🃏 Mes Decks</span>
            <button
              onClick={() => {
                setOpen(false);
                navigate("/decks");
              }}
              style={s.btnManage}
            >
              Gérer
            </button>
          </div>

          {isLoading ? (
            <p style={s.muted}>Chargement…</p>
          ) : decks.length === 0 ? (
            <div style={s.empty}>
              <p style={s.muted}>Aucun deck</p>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/decks");
                }}
                style={s.btnCreate}
              >
                + Créer un deck
              </button>
            </div>
          ) : (
            <ul style={s.list}>
              {decks.map((deck) => {
                const total = deck.deckCards.reduce(
                  (acc, dc) => acc + dc.quantity,
                  0,
                );
                const selected = deck.id === selectedDeckId;
                return (
                  <li
                    key={deck.id}
                    style={{
                      ...s.item,
                      background: selected ? "#f8edf2" : "#fff",
                      border: selected
                        ? "1.5px solid #7a1c3b"
                        : "1.5px solid transparent",
                    }}
                  >
                    <div style={s.itemInfo}>
                      <span style={s.itemName}>{deck.name}</span>
                      <span style={s.itemCount}>{total} cartes</span>
                    </div>
                    {onSelectDeck && (
                      <button
                        onClick={() => {
                          onSelectDeck(deck.id);
                          setOpen(false);
                        }}
                        style={selected ? s.btnSelected : s.btnSelect}
                      >
                        {selected ? "✓ Sélectionné" : "Utiliser"}
                      </button>
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

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
    fontFamily: "Comfortaa, sans-serif",
  },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fff",
    border: "1.5px solid #f0ddd0",
    borderRadius: 12,
    padding: "10px 16px",
    cursor: "pointer",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 14,
    color: "#7a1c3b",
    boxShadow: "0 2px 8px rgba(122,28,59,0.08)",
    fontWeight: 700,
    transition: "box-shadow .2s",
  },
  triggerIcon: { fontSize: 18 },
  triggerLabel: { fontSize: 14 },
  chevron: {
    fontSize: 12,
    transition: "transform .2s",
    display: "inline-block",
  },
  panel: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 300,
    background: "#fff",
    border: "1.5px solid #f0ddd0",
    borderRadius: 14,
    boxShadow: "0 8px 28px rgba(122,28,59,0.14)",
    zIndex: 200,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #f0e8e2",
    background: "#fdf6f0",
  },
  panelTitle: {
    fontFamily: "Lilita One, sans-serif",
    color: "#7a1c3b",
    fontSize: 16,
  },
  muted: { color: "#aaa", fontSize: 13, margin: "12px 16px" },
  empty: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 10,
    transition: "background .15s, border .15s",
  },
  itemInfo: { display: "flex", flexDirection: "column", gap: 2 },
  itemName: { fontSize: 14, fontWeight: 600, color: "#2c1a12" },
  itemCount: { fontSize: 12, color: "#aaa" },
  btnManage: {
    background: "transparent",
    border: "1.5px solid #7a1c3b",
    color: "#7a1c3b",
    borderRadius: 8,
    padding: "5px 12px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  btnCreate: {
    background: "#7a1c3b",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 16px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "pointer",
  },
  btnSelect: {
    background: "#f0ddd0",
    color: "#7a1c3b",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  btnSelected: {
    background: "#7a1c3b",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 12,
    cursor: "default",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};
