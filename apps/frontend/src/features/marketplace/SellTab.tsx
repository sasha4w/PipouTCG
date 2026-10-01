import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Transaction,
  type UpdateListingData,
} from "../../services/transaction.service";
import TransactionHistory from "./TransactionHistory";
import ListingEditForm from "./ListingEditForm";
import ListingPreview from "./ListingPreview";
import "./SellTab.css";
import "./ListingCard.css";

interface SellTabProps {
  userListings: Transaction[] | undefined;
  userSellHistory: Transaction[] | undefined;
  loadingAction: number | null;
  loadingUpdate: number | null;
  getDisplayName: (listing: Transaction) => string;
  /** Quantité maximale possible pour l'annonce (en vente + inventaire). */
  getMaxQuantity: (listing: Transaction) => number;
  onCreateListing: () => void;
  onCancelListing: (id: number) => void;
  onUpdateListing: (id: number, data: UpdateListingData) => void;
}

const SellTab = ({
  userListings,
  userSellHistory,
  loadingAction,
  loadingUpdate,
  getDisplayName,
  getMaxQuantity,
  onCreateListing,
  onCancelListing,
  onUpdateListing,
}: SellTabProps) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);

  const submitEdit = (id: number, data: UpdateListingData) => {
    onUpdateListing(id, data);
    setEditingId(null);
  };

  return (
    <div className="marketplace-sell">
      <h2 className="marketplace-section__title">
        {t("marketplace.sell.title")}
      </h2>
      <div className="marketplace-header-actions">
        <button
          className="marketplace-create-listing-btn"
          onClick={onCreateListing}
        >
          {t("marketplace.sell.btn_create")}
        </button>
      </div>

      <div className="marketplace-listings">
        {userListings?.length === 0 ? (
          <p className="marketplace-empty">{t("marketplace.sell.empty")}</p>
        ) : (
          userListings?.map((listing: Transaction) => {
            const isEditing = editingId === listing.id;
            const isActioning = loadingAction === listing.id;
            const isUpdating = loadingUpdate === listing.id;
            const busy = isActioning || isUpdating;

            if (isEditing) {
              return (
                <ListingEditForm
                  key={listing.id}
                  listing={listing}
                  name={getDisplayName(listing)}
                  maxQuantity={getMaxQuantity(listing)}
                  busy={busy}
                  onSubmit={(data) => submitEdit(listing.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            return (
              <div
                key={listing.id}
                className={`marketplace-listing${listing.card ? " marketplace-listing--card" : ""}`}
              >
                <ListingPreview
                  listing={listing}
                  name={getDisplayName(listing)}
                />

                <div className="marketplace-listing__bottom marketplace-listing__bottom--sell">
                  <div className="marketplace-listing__sell-prices">
                    <span className="marketplace-listing__sell-unit">
                      {t("marketplace.sell.unit_price", {
                        price: listing.unitPrice,
                      })}
                    </span>
                    <span className="marketplace-listing__sell-total">
                      {t("marketplace.sell.total", {
                        total: listing.unitPrice * listing.quantity,
                      })}
                    </span>
                  </div>
                  <div className="marketplace-listing__actions">
                    <button
                      className="marketplace-edit-btn"
                      onClick={() => setEditingId(listing.id)}
                      disabled={busy}
                    >
                      {t("marketplace.sell.btn_edit")}
                    </button>
                    <button
                      className="marketplace-cancel-btn"
                      onClick={() => onCancelListing(listing.id)}
                      disabled={busy}
                    >
                      {isActioning ? "..." : t("marketplace.sell.btn_cancel")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <h2 className="marketplace-section__title marketplace-section__title--history">
        {t("marketplace.sell.history_title")}
      </h2>
      <TransactionHistory
        history={userSellHistory}
        emptyMessage={t("marketplace.sell.history_empty")}
      />
    </div>
  );
};

export default SellTab;
