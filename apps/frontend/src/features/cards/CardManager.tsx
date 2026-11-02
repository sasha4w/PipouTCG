import { useState, useMemo } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cardService, Rarity } from "../../services/card.service";
import { cardSetService } from "../../services/card-set.service";
import type { Card } from "../../services/card.service";
import type { CardSet } from "../../services/card-set.service";
import SearchBar from "../../components/Searchbar";
import FilterPanel from "../../components/FilterPanel";
import { useFilters } from "../../hooks/useFilters";
import { QUERY_KEYS } from "../../utils/querykeys";
import Button from "../../components/Button";
import {
  IconArrowLeft,
  IconArrowRight,
  IconPencil,
  IconTrash,
} from "../../components/Icons";
import "../../components/manager.css";
import CardForm from "./card-form/CardForm";

// Références stables tant que les requêtes ne sont pas résolues (dépendances de useMemo)
const NO_CARDS: Card[] = [];
const NO_SETS: CardSet[] = [];

type View = "list" | "edit";

export default function CardManager() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const setsQuery = useQuery({
    queryKey: QUERY_KEYS.cardSetOptions,
    queryFn: () => cardSetService.findAll(1, 100),
  });
  const sets = setsQuery.data?.data ?? NO_SETS;
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<Card | null>(null);
  const [search, setSearch] = useState("");
  const [groupBySet, setGroupBySet] = useState(false);

  const filterConfig = useMemo(
    () => [
      {
        key: "set",
        label: "Set",
        options: [
          { value: "all", label: "Tous" },
          ...sets.map((s) => ({ value: String(s.id), label: s.name })),
        ],
      },
      {
        key: "type",
        label: "Type",
        options: [
          { value: "all", label: "Tous" },
          { value: "monster", label: "Monstre" },
          { value: "support", label: "Support" },
        ],
      },
      {
        key: "rarity",
        label: "Rareté",
        options: [
          { value: "all", label: "Toutes" },
          ...Object.values(Rarity).map((r) => ({
            value: r.toLowerCase(),
            label: r,
          })),
        ],
      },
    ],
    [sets],
  );

  const { filterValues, setFilter } = useFilters(filterConfig);

  const cardsQuery = useQuery({
    queryKey: QUERY_KEYS.admin.cards(page),
    queryFn: () => cardService.findAll(page, 10),
    placeholderData: keepPreviousData,
  });
  const cards = cardsQuery.data?.data ?? NO_CARDS;
  const total = cardsQuery.data?.meta.totalPages ?? 0;
  const loading = cardsQuery.isPending;
  const loadError =
    cardsQuery.isError || setsQuery.isError
      ? "Erreur de chargement"
      : "";

  // Une nouvelle image peut avoir été uploadée avec la carte
  const refreshList = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "cards"] }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cardOptions }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.imageOptions }),
    ]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (
        filterValues.set !== "all" &&
        String(c.cardSet.id) !== filterValues.set
      )
        return false;
      if (
        filterValues.type !== "all" &&
        c.type?.toLowerCase() !== filterValues.type
      )
        return false;
      if (
        filterValues.rarity !== "all" &&
        c.rarity?.toLowerCase() !== filterValues.rarity
      )
        return false;
      return true;
    });
  }, [cards, search, filterValues]);

  const groupedBySet = useMemo(() => {
    if (!groupBySet) return null;
    const map = new Map<number, { setName: string; cards: Card[] }>();
    filtered.forEach((c) => {
      const g = map.get(c.cardSet.id);
      if (g) g.cards.push(c);
      else map.set(c.cardSet.id, { setName: c.cardSet.name, cards: [c] });
    });
    return Array.from(map.entries());
  }, [filtered, groupBySet]);

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setError("");
    setView("edit");
  };
  const openEdit = (c: Card) => {
    setEditing(c);
    setError("");
    setView("edit");
  };
  const backToList = () => {
    setView("list");
    setEditing(null);
    setError("");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette carte ?")) return;
    try {
      await cardService.remove(id);
      void refreshList();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const renderCard = (c: Card) => (
    <div key={c.id} className="manager-item">
      {c.image && (
        <img
          src={c.image.url}
          alt={c.name}
          style={{
            width: 32,
            height: 40,
            objectFit: "cover",
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
      )}
      <div className="manager-item__info">
        <div className="manager-item__name">{c.name}</div>
        <div className="manager-item__meta">
          {c.rarity} · {c.type} · {c.cardSet.name} · ATK {c.atk} / HP {c.hp}
        </div>
      </div>
      <div className="manager-item__actions">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          aria-label="Modifier"
          title="Modifier"
          onClick={() => openEdit(c)}
        >
          <IconPencil size={16} />
        </Button>
        <Button
          variant="danger"
          size="icon"
          aria-label="Supprimer"
          title="Supprimer"
          onClick={() => handleDelete(c.id)}
        >
          <IconTrash size={16} />
        </Button>
      </div>
    </div>
  );

  // ══ VUE LISTE ════════════════════════════════════════════════════════════════
  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Cartes</h2>
          <Button size="sm" onClick={openCreate}>
            + Nouvelle
          </Button>
        </div>

        {(error || loadError) && (
          <p className="manager-error">{error || loadError}</p>
        )}

        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Rechercher une carte…"
          extra={
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#7a1c3b",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={groupBySet}
                onChange={(e) => setGroupBySet(e.target.checked)}
                style={{ accentColor: "#7a1c3b" }}
              />
              Par set
            </label>
          }
        />

        <FilterPanel
          config={filterConfig}
          values={filterValues}
          onChange={(k, v) => applyFilter(() => setFilter(k, v))}
        />

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="manager-empty">Aucune carte.</p>
        ) : groupBySet && groupedBySet ? (
          groupedBySet.map(([setId, { setName, cards: setCards }]) => (
            <div key={setId} style={{ marginBottom: "1rem" }}>
              <div className="manager-set-header">
                <span className="manager-set-name">{setName}</span>
                <span className="manager-set-count">
                  {setCards.length} carte{setCards.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="manager-list">{setCards.map(renderCard)}</div>
            </div>
          ))
        ) : (
          <div className="manager-list">{filtered.map(renderCard)}</div>
        )}

        {total > 1 && (
          <div className="manager-pagination">
            <Button
              variant="ghost-bordeaux"
              size="icon"
              aria-label="Page précédente"
              title="Page précédente"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <IconArrowLeft size={16} />
            </Button>
            <span className="manager-pagination__info">
              {page} / {total}
            </span>
            <Button
              variant="ghost-bordeaux"
              size="icon"
              aria-label="Page suivante"
              title="Page suivante"
              disabled={page >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              <IconArrowRight size={16} />
            </Button>
          </div>
        )}
      </div>
    );

  // ══ VUE FORMULAIRE ═══════════════════════════════════════════════════════════
  return (
    <CardForm
      card={editing}
      onDone={() => {
        backToList();
        void refreshList();
      }}
    />
  );
}
