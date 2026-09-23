import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { UserCollection } from "../../services/user.service";
import type { Card } from "../../services/card.service";
import CardDisplay from "../cards/CardDisplay";
import { soundService } from "../../services/sound.service";
import SearchBar from "../../components/Searchbar";
import { IconUnknown } from "../../components/Icons";
import FilterPanel, { useFilters } from "../../components/FilterPanel";
import "./OwnCardList.css";

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
    cardSet: { id: 0, name: "" },
  };
}

const PAGE_SIZE = 6;

interface OwnCardListProps {
  collection: UserCollection;
}

export default function OwnCardList({ collection }: OwnCardListProps) {
  const { t } = useTranslation();

  const filterConfig = useMemo(
    () => [
      {
        key: "type",
        label: t("filter.type"),
        options: [
          { value: "all", label: t("filter.all") },
          { value: "monster", label: t("filter.monster") },
          { value: "support", label: t("filter.support") },
        ],
      },
      {
        key: "rarity",
        label: t("filter.rarity"),
        options: [
          { value: "all", label: t("filter.all_rarities") },
          { value: "common", label: t("rarity.common") },
          { value: "uncommon", label: t("rarity.uncommon") },
          { value: "rare", label: t("rarity.rare") },
          { value: "epic", label: t("rarity.epic") },
          { value: "legendary", label: t("rarity.legendary") },
          { value: "secret", label: t("rarity.secret") },
        ],
      },
    ],
    [t],
  );

  const { filterValues, setFilter, hasActiveFilters } =
    useFilters(filterConfig);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showMissing, setShowMissing] = useState(true);
  const [filterSet, setFilterSet] = useState<number | "all">("all");

  const allCards = useMemo(() => {
    const sets =
      filterSet === "all"
        ? collection.sets
        : collection.sets.filter((s) => s.id === filterSet);
    return sets.flatMap((set) =>
      set.cards.map((card) => ({ ...card, setId: set.id, setName: set.name })),
    );
  }, [collection, filterSet]);

  const filtered = useMemo(() => {
    return allCards.filter((c) => {
      if (!showMissing && !c.owned) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
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
  }, [allCards, search, filterValues, showMissing]);

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sliceBySet = useMemo(() => {
    const groups = new Map<number, { setName: string; items: typeof slice }>();
    slice.forEach((item) => {
      const g = groups.get(item.setId);
      if (g) g.items.push(item);
      else groups.set(item.setId, { setName: item.setName, items: [item] });
    });
    return Array.from(groups.entries());
  }, [slice]);

  const totalOwned = allCards.filter((c) => c.owned).length;
  const totalCards = allCards.length;

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
        <option value="all">{t("collection.all_sets")}</option>
        {collection.sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.owned}/{s.total})
          </option>
        ))}
      </select>

      {/* Recherche + Filtres */}
      <SearchBar
        value={search}
        onChange={(val) => applyFilter(() => setSearch(val))}
        placeholder={t("search.placeholder")}
        hasActiveFilters={hasActiveFilters}
        filters={
          <FilterPanel
            config={filterConfig}
            values={filterValues}
            onChange={(key, val) => applyFilter(() => setFilter(key, val))}
          />
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
        {t("collection.show_missing")}
      </label>

      {/* Compteur */}
      <span className="own-cardlist__result-count">
        {totalOwned} / {totalCards} {t("collection.cards").toLowerCase()}
        {totalCards > 1 ? "s" : ""}
      </span>

      {/* Grille */}
      {slice.length === 0 ? (
        <p className="own-cardlist__empty">{t("collection.no_cards")}</p>
      ) : (
        sliceBySet.map(([setId, { setName, items }]) => {
          const setData = collection.sets.find((s) => s.id === setId);
          const isComplete = setData ? setData.owned === setData.total : false;
          return (
            <div key={setId}>
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
                    {item.owned ? (
                      <CardDisplay
                        card={toCard(item)}
                        size="lg"
                        interactive={true}
                        flippable={true}
                      />
                    ) : (
                      <div className="own-cardlist__card-unknown">
                        <IconUnknown
                          size={48}
                          color="rgba(160, 128, 112, 0.4)"
                        />
                        <span className="own-cardlist__card-missing-label">
                          {t("collection.not_owned")}
                        </span>
                        <span className="own-cardlist__card-missing-rarity">
                          {t(`rarity.${item.rarity.toLowerCase()}`)}
                        </span>
                      </div>
                    )}
                    {item.owned && item.quantity > 0 && (
                      <span className="own-cardlist__qty-badge">
                        ×{item.quantity}
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
