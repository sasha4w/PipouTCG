import { useState, useMemo } from "react";
import type { UserCollection } from "../../services/user.service";
import type { Card } from "../../services/card.service";
import CardDisplay from "../cards/CardDisplay";
import { soundService } from "../../services/sound.service";
import SearchBar from "../../components/Searchbar";
import "./OwnCardList.css";

// ── Mappe une carte de collection vers le type Card ───────────────────────────
function toCard(item: UserCollection["sets"][0]["cards"][0]): Card {
  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity as Card["rarity"],
    type: item.type as Card["type"],
    supportType: (item.supportType as Card["supportType"]) ?? null,
    atk: item.atk,
    hp: item.hp,
    cost: item.cost,
    description: item.description ?? undefined,
    image: item.image ?? null,
    cardSet: { id: 0, name: "" }, // non utilisé dans l'affichage
  };
}

const PAGE_SIZE = 6;

const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "secret",
] as const;
const RARITY_LABELS: Record<string, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  secret: "Secrète",
};

interface OwnCardListProps {
  collection: UserCollection;
}

export default function OwnCardList({ collection }: OwnCardListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "monster" | "support">(
    "all",
  );
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [showMissing, setShowMissing] = useState(true);
  const [filterSet, setFilterSet] = useState<number | "all">("all");

  // ── Aplatit toutes les cartes (filtrées par set si besoin) ──────────────
  const allCards = useMemo(() => {
    const sets =
      filterSet === "all"
        ? collection.sets
        : collection.sets.filter((s) => s.id === filterSet);
    return sets.flatMap((set) =>
      set.cards.map((card) => ({ ...card, setId: set.id, setName: set.name })),
    );
  }, [collection, filterSet]);

  // ── Filtre ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allCards.filter((c) => {
      if (!showMissing && !c.owned) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterType !== "all" && c.type?.toLowerCase() !== filterType)
        return false;
      if (filterRarity !== "all" && c.rarity?.toLowerCase() !== filterRarity)
        return false;
      return true;
    });
  }, [allCards, search, filterType, filterRarity, showMissing]);

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Groupe le slice courant par set ───────────────────────────────────────
  const sliceBySet = useMemo(() => {
    const groups = new Map<number, { setName: string; items: typeof slice }>();
    slice.forEach((item) => {
      const g = groups.get(item.setId);
      if (g) g.items.push(item);
      else groups.set(item.setId, { setName: item.setName, items: [item] });
    });
    return Array.from(groups.entries());
  }, [slice]);

  // ── Stats globales ────────────────────────────────────────────────────────
  const totalOwned = allCards.filter((c) => c.owned).length;
  const totalCards = allCards.length;

  // ── Helpers filtres ───────────────────────────────────────────────────────
  const typeBtn = (val: typeof filterType, label: string) => (
    <button
      key={val}
      className={`own-cardlist__filter-btn${filterType === val ? " own-cardlist__filter-btn--active" : ""}`}
      onClick={() => applyFilter(() => setFilterType(val))}
    >
      {label}
    </button>
  );
  const rarityBtn = (val: string, label: string) => (
    <button
      key={val}
      className={`own-cardlist__filter-btn${filterRarity === val ? " own-cardlist__filter-btn--active" : ""}`}
      onClick={() => applyFilter(() => setFilterRarity(val))}
    >
      {label}
    </button>
  );

  return (
    <div className="own-cardlist">
      {/* Sélecteur de set */}
      <select
        className="own-cardlist__search"
        value={filterSet}
        onChange={(e) => {
          setFilterSet(
            e.target.value === "all" ? "all" : Number(e.target.value),
          );
          setPage(1);
        }}
        style={{ cursor: "pointer" }}
      >
        <option value="all">Tous les sets</option>
        {collection.sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.owned}/{s.total})
          </option>
        ))}
      </select>

      {/* Recherche */}
      <SearchBar
        value={search}
        onChange={(val) => applyFilter(() => setSearch(val))}
        placeholder="Rechercher une carte..."
        hasActiveFilters={filterType !== "all" || filterRarity !== "all"}
        filters={
          <>
            {/* Filtres */}
            <div className="own-cardlist__filters">
              <div className="own-cardlist__filter-group">
                {typeBtn("all", "Tous")}
                {typeBtn("monster", "Monstre")}
                {typeBtn("support", "Support")}
              </div>
              <div className="own-cardlist__filter-sep" />
              <div className="own-cardlist__filter-group">
                {rarityBtn("all", "Toutes")}
                {RARITIES.map((r) => rarityBtn(r, RARITY_LABELS[r]))}
              </div>
            </div>
          </>
        }
      />

      {/* Toggle cartes manquantes */}
      <label className="own-cardlist__toggle-missing">
        <input
          type="checkbox"
          checked={showMissing}
          onChange={(e) => {
            setShowMissing(e.target.checked);
            setPage(1);
          }}
        />
        Afficher les cartes non obtenues
      </label>

      {/* Compteur global */}
      <span className="own-cardlist__result-count">
        {totalOwned} / {totalCards} carte{totalCards > 1 ? "s" : ""} obtenue
        {totalOwned > 1 ? "s" : ""}
      </span>

      {/* Grille groupée par set */}
      {slice.length === 0 ? (
        <p className="own-cardlist__empty">Aucune carte trouvée.</p>
      ) : (
        sliceBySet.map(([setId, { setName, items }]) => {
          const setData = collection.sets.find((s) => s.id === setId);
          const isComplete = setData ? setData.owned === setData.total : false;
          return (
            <div key={setId}>
              {/* Header set avec compteur */}
              <div className="own-cardlist__set-header">
                <span className="own-cardlist__set-name">{setName}</span>
                {setData && (
                  <span
                    className={`own-cardlist__set-count${isComplete ? " own-cardlist__set-count--complete" : ""}`}
                  >
                    {setData.owned} / {setData.total}
                    {isComplete ? " ✓" : ""}
                  </span>
                )}
              </div>

              <div className="own-cardlist__grid" style={{ marginTop: 8 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ position: "relative" }}>
                    <div
                      className={item.owned ? "" : "own-cardlist__card-missing"}
                    >
                      <CardDisplay
                        card={toCard(item)}
                        size="lg"
                        interactive={item.owned}
                        flippable={item.owned}
                      />
                    </div>
                    {item.owned && item.quantity > 0 && (
                      <span className="own-cardlist__qty-badge">
                        ×{item.quantity}
                      </span>
                    )}
                    {!item.owned && (
                      <span className="own-cardlist__card-missing-label">
                        Non obtenue
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="own-cardlist__pagination">
          <button
            className="own-cardlist__pagination-btn"
            disabled={page <= 1}
            onClick={() => {
              soundService.play("select");
              setPage((p) => p - 1);
            }}
          >
            ←
          </button>
          <span className="own-cardlist__pagination-info">
            {page} / {totalPages}
          </span>
          <button
            className="own-cardlist__pagination-btn"
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
