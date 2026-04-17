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
  onBuyListing: (id: number) => void;
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
        {filteredListings?.map((listing: Transaction) => (
          <div key={listing.id} className="marketplace-listing">
            {/* Badge Quantité */}
            <div className="marketplace-listing__qty">x{listing.quantity}</div>

            {/* Zone Image / Nom */}
            <div className="marketplace-listing__top">
              <svg
                width="40"
                height="40"
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
            </div>

            {/* Zone Info / Action */}
            <div className="marketplace-listing__bottom">
              <span className="marketplace-listing__seller">
                Par: <strong>{listing.seller?.username || "Inconnu"}</strong>
              </span>

              <div className="marketplace-listing__price">
                <span>{listing.unitPrice} G</span>
                <button
                  className="marketplace-buy-btn"
                  onClick={() => onBuyListing(listing.id)}
                  disabled={loadingAction === listing.id}
                >
                  {loadingAction === listing.id ? "..." : "Acheter"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BuyTab;
