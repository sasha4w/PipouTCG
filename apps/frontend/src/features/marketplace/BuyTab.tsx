import { useState } from "react";
import { useTranslation } from "react-i18next";
import SearchBar from "../../components/Searchbar";
import FilterPanel from "../../components/FilterPanel";
import Button from "../../components/Button";
import { IconMinus, IconPlus } from "../../components/Icons";
import { type Transaction } from "../../services/transaction.service";
import {
  type FilterConfig,
  type FilterValues,
} from "../../components/FilterPanel";
import TransactionHistory from "./TransactionHistory";
import ListingPreview from "./ListingPreview";
import "./BuyTab.css";
import "./ListingCard.css";

interface BuyTabProps {
  filteredListings: Transaction[] | undefined;
  buyHistory: Transaction[] | undefined;
  loadingAction: number | null;
  searchTerm: string;
  filterConfig: FilterConfig[];
  filterValues: FilterValues;
  hasActiveFilters: boolean;
  getDisplayName: (listing: Transaction) => string;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onResetFilters: () => void;
  onBuyListing: (id: number, quantity: number) => void;
}

const BuyTab = ({
  filteredListings,
  buyHistory,
  loadingAction,
  searchTerm,
  filterConfig,
  filterValues,
  hasActiveFilters,
  getDisplayName,
  onSearchChange,
  onFilterChange,
  onResetFilters,
  onBuyListing,
}: BuyTabProps) => {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const getQty = (id: number) => quantities[id] ?? 1;
  const setQty = (id: number, max: number, value: number) => {
    const clamped = Math.min(Math.max(1, value), max);
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  };

  return (
    <div className="marketplace-buy">
      <h2 className="marketplace-section__title">
        {t("marketplace.buy.title")}
      </h2>
      <SearchBar
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={t("marketplace.buy.search_placeholder")}
        filters={
          <FilterPanel
            config={filterConfig}
            values={filterValues}
            onChange={onFilterChange}
            onReset={hasActiveFilters ? onResetFilters : undefined}
          />
        }
        hasActiveFilters={hasActiveFilters}
      />
      <div className="marketplace-listings">
        {filteredListings?.length === 0 && (
          <p className="marketplace-empty">{t("marketplace.buy.empty")}</p>
        )}
        {filteredListings?.map((listing: Transaction) => {
          const qty = getQty(listing.id);
          const totalForQty = listing.unitPrice * qty;
          const isLoading = loadingAction === listing.id;

          return (
            <div
              key={listing.id}
              className={`marketplace-listing${listing.card ? " marketplace-listing--card" : ""}`}
            >
              <ListingPreview
                listing={listing}
                name={getDisplayName(listing)}
              />

              <div className="marketplace-listing__qty-selector">
                <Button
                  variant="ghost-gold"
                  size="icon"
                  onClick={() => setQty(listing.id, listing.quantity, qty - 1)}
                  disabled={qty <= 1 || isLoading}
                  aria-label={t("marketplace.qty.reduce")}
                >
                  <IconMinus size={16} />
                </Button>
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
                <Button
                  variant="ghost-gold"
                  size="icon"
                  onClick={() => setQty(listing.id, listing.quantity, qty + 1)}
                  disabled={qty >= listing.quantity || isLoading}
                  aria-label={t("marketplace.qty.increase")}
                >
                  <IconPlus size={16} />
                </Button>
                {listing.quantity > 1 && (
                  <Button
                    variant="ghost-gold"
                    size="sm"
                    className="marketplace-qty-max"
                    onClick={() =>
                      setQty(listing.id, listing.quantity, listing.quantity)
                    }
                    disabled={isLoading}
                  >
                    {t("marketplace.qty.max")}
                  </Button>
                )}
              </div>

              <div className="marketplace-listing__bottom">
                <span className="marketplace-listing__seller">
                  {t("marketplace.buy.seller")}{" "}
                  <strong>{listing.seller?.username || "—"}</strong>
                </span>
                <div className="marketplace-listing__price">
                  <div className="marketplace-listing__price-info">
                    <span className="marketplace-listing__unit-price">
                      {t("marketplace.buy.unit_price", {
                        price: listing.unitPrice,
                      })}
                    </span>
                    {qty > 1 && (
                      <span className="marketplace-listing__total-price">
                        {t("marketplace.buy.total_price", {
                          total: totalForQty,
                        })}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => onBuyListing(listing.id, qty)}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? t("marketplace.buy.loading")
                      : t("marketplace.buy.btn_buy", { total: totalForQty })}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="marketplace-section__title marketplace-section__title--history">
        {t("marketplace.buy.history_title")}
      </h2>
      <TransactionHistory
        history={buyHistory}
        emptyMessage={t("marketplace.buy.history_empty")}
      />
    </div>
  );
};

export default BuyTab;
