import { useState } from "react";
import SearchBar from "../../components/Searchbar";
import FilterPanel from "../../components/FilterPanel";
import { type Transaction } from "../../services/transaction.service";
import {
  type FilterConfig,
  type FilterValues,
} from "../../components/FilterPanel";
import "./BuyTab.css";
import "./ListingCard.css";

// ─────────────────────────────────────────────
// 🛒 COMPOSANT : BuyTab
// ─────────────────────────────────────────────
interface BuyTabProps {
  filteredListings: Transaction[] | undefined;
  loadingAction: number | null;
  searchTerm: string;
  filterConfig: FilterConfig[];
  filterValues: FilterValues;
  hasActiveFilters: boolean;
  getDisplayName: (listing: Transaction) => string;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onBuyListing: (id: number, quantity: number) => void;
}

const BuyTab = ({
  filteredListings,
  loadingAction,
  searchTerm,
  filterConfig,
  filterValues,
  hasActiveFilters,
  getDisplayName,
  onSearchChange,
  onFilterChange,
  onBuyListing,
}: BuyTabProps) => {
  // Quantité sélectionnée par listing (clé = listing.id)
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const getQty = (id: number) => quantities[id] ?? 1;

  const setQty = (id: number, max: number, value: number) => {
    const clamped = Math.min(Math.max(1, value), max);
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  };

  return (
    <div className="marketplace-buy">
      <h2 className="marketplace-section__title">Marché</h2>
      <SearchBar
        value={searchTerm}
        onChange={onSearchChange}
        placeholder="Rechercher un objet ou un vendeur..."
        filters={
          <FilterPanel
            config={filterConfig}
            values={filterValues}
            onChange={onFilterChange}
          />
        }
        hasActiveFilters={hasActiveFilters}
      />
      <div className="marketplace-listings">
        {filteredListings?.map((listing: Transaction) => {
          const qty = getQty(listing.id);
          const totalForQty = listing.unitPrice * qty;
          const isLoading = loadingAction === listing.id;

          return (
            <div key={listing.id} className="marketplace-listing">
              {/* Zone Image / Nom + Badge */}
              <div className="marketplace-listing__top">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7a1c3b"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <path d="M20.4 14.5L16 10 4 20"></path>
                </svg>
                <div className="marketplace-listing__name">
                  {getDisplayName(listing)}
                </div>
                <div className="marketplace-listing__qty">
                  ×{listing.quantity}
                </div>
              </div>

              {/* Sélecteur de quantité */}
              <div className="marketplace-listing__qty-selector">
                <button
                  className="marketplace-qty-btn"
                  onClick={() => setQty(listing.id, listing.quantity, qty - 1)}
                  disabled={qty <= 1 || isLoading}
                  aria-label="Réduire la quantité"
                >
                  −
                </button>
                <input
                  className="marketplace-qty-input"
                  type="number"
                  min={1}
                  max={listing.quantity}
                  value={qty}
                  onChange={(e) =>
                    setQty(listing.id, listing.quantity, Number(e.target.value))
                  }
                  disabled={isLoading}
                />
                <button
                  className="marketplace-qty-btn"
                  onClick={() => setQty(listing.id, listing.quantity, qty + 1)}
                  disabled={qty >= listing.quantity || isLoading}
                  aria-label="Augmenter la quantité"
                >
                  +
                </button>
                {listing.quantity > 1 && (
                  <button
                    className="marketplace-qty-max"
                    onClick={() =>
                      setQty(listing.id, listing.quantity, listing.quantity)
                    }
                    disabled={isLoading}
                  >
                    Max
                  </button>
                )}
              </div>

              {/* Zone Info / Action */}
              <div className="marketplace-listing__bottom">
                <span className="marketplace-listing__seller">
                  Par: <strong>{listing.seller?.username || "Inconnu"}</strong>
                </span>
                <div className="marketplace-listing__price">
                  <div className="marketplace-listing__price-info">
                    <span className="marketplace-listing__unit-price">
                      {listing.unitPrice} G / unité
                    </span>
                    {qty > 1 && (
                      <span className="marketplace-listing__total-price">
                        Total : {totalForQty} G
                      </span>
                    )}
                  </div>
                  <button
                    className="marketplace-buy-btn"
                    onClick={() => onBuyListing(listing.id, qty)}
                    disabled={isLoading}
                  >
                    {isLoading ? "..." : `Acheter (${totalForQty} G)`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BuyTab;
