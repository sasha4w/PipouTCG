import { useState, useMemo } from "react";
import type { UserInventory } from "../../services/user.service";
import type { Card } from "../../services/card.service";
import CardDisplay from "../cards/CardDisplay";
import { soundService } from "../../services/sound.service";
import "./OwnCardList.css";

// ── Mappe un item d'inventaire vers le type Card ───────────────────────────────
function toCard(item: UserInventory["cards"]["data"][0]): Card {
  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity as Card["rarity"],
    type: item.type as Card["type"],
    atk: item.atk,
    hp: item.hp,
    cost: item.cost ?? 0,
    supportType: (item.supportType as Card["supportType"]) ?? null,
    description: item.description ?? undefined,
    image: item.image ?? null,
    cardSet: { id: item.setId, name: item.set },
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
  cards: UserInventory["cards"]["data"];
}

export default function OwnCardList({ cards }: OwnCardListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "monster" | "support">(
    "all",
  );
  const [filterRarity, setFilterRarity] = useState<string>("all");

  // ── Filtre + recherche ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterType !== "all" && c.type.toLowerCase() !== filterType)
        return false;
      if (filterRarity !== "all" && c.rarity.toLowerCase() !== filterRarity)
        return false;
      return true;
    });
  }, [cards, search, filterType, filterRarity]);

  // Reset page quand les filtres changent
  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Helpers bouton filtre ───────────────────────────────────────────────────
  const typeBtn = (val: typeof filterType, label: string) => (
    <button
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
      {/* ── Recherche ── */}
      <input
        className="own-cardlist__search"
        type="text"
        placeholder="🔍 Rechercher une carte..."
        value={search}
        onChange={(e) => applyFilter(() => setSearch(e.target.value))}
      />

      {/* ── Filtres type ── */}
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

      {/* ── Résultat ── */}
      <span className="own-cardlist__result-count">
        {filtered.length} carte{filtered.length > 1 ? "s" : ""}
        {filtered.length !== cards.length && ` sur ${cards.length}`}
      </span>

      {/* ── Grille ── */}
      {slice.length === 0 ? (
        <p className="own-cardlist__empty">Aucune carte trouvée.</p>
      ) : (
        <div className="own-cardlist__grid">
          {slice.map((item) => (
            <div key={item.id} style={{ position: "relative" }}>
              <CardDisplay
                card={toCard(item)}
                size="lg"
                interactive
                flippable
              />
              <span className="own-cardlist__qty-badge">×{item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
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
