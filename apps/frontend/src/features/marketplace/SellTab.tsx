import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Transaction,
  type UpdateListingData,
} from "../../services/transaction.service";
import TransactionHistory from "./TransactionHistory";
import "./SellTab.css";
import "./ListingCard.css";

interface SellTabProps {
  userListings: Transaction[] | undefined;
  userSellHistory: Transaction[] | undefined;
  loadingAction: number | null;
  loadingUpdate: number | null;
  getDisplayName: (listing: Transaction) => string;
  onCreateListing: () => void;
  onCancelListing: (id: number) => void;
  onUpdateListing: (id: number, data: UpdateListingData) => void;
}

interface EditForm {
  quantity: number;
  unitPrice: number;
}

const SellTab = ({
  userListings,
  userSellHistory,
  loadingAction,
  loadingUpdate,
  getDisplayName,
  onCreateListing,
  onCancelListing,
  onUpdateListing,
}: SellTabProps) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    quantity: 1,
    unitPrice: 1,
  });

  const startEdit = (listing: Transaction) => {
    setEditingId(listing.id);
    setEditForm({ quantity: listing.quantity, unitPrice: listing.unitPrice });
  };
  const cancelEdit = () => setEditingId(null);
  const submitEdit = (id: number) => {
    onUpdateListing(id, {
      quantity: editForm.quantity,
      unitPrice: editForm.unitPrice,
    });
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

            return (
              <div key={listing.id} className="marketplace-listing">
                <div className="marketplace-listing__top">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7a1c3b"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M20.4 14.5L16 10 4 20" />
                  </svg>
                  <div className="marketplace-listing__name">
                    {getDisplayName(listing)}
                  </div>
                  {!isEditing && (
                    <div className="marketplace-listing__qty">
                      ×{listing.quantity}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="marketplace-listing__edit-form">
                    <label className="marketplace-listing__edit-label">
                      {t("marketplace.sell.edit_quantity")}
                      <input
                        className="marketplace-listing__edit-input"
                        type="number"
                        min={1}
                        value={editForm.quantity}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            quantity: Math.max(1, Number(e.target.value)),
                          }))
                        }
                        disabled={busy}
                      />
                    </label>
                    <label className="marketplace-listing__edit-label">
                      {t("marketplace.sell.edit_price")}
                      <input
                        className="marketplace-listing__edit-input"
                        type="number"
                        min={1}
                        value={editForm.unitPrice}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            unitPrice: Math.max(1, Number(e.target.value)),
                          }))
                        }
                        disabled={busy}
                      />
                    </label>
                    <div className="marketplace-listing__edit-preview">
                      {t("marketplace.sell.edit_total", {
                        total: editForm.quantity * editForm.unitPrice,
                      })}
                    </div>
                    <div className="marketplace-listing__edit-actions">
                      <button
                        className="marketplace-save-btn"
                        onClick={() => submitEdit(listing.id)}
                        disabled={busy}
                      >
                        {isUpdating ? "..." : t("marketplace.sell.btn_save")}
                      </button>
                      <button
                        className="marketplace-cancel-btn"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        {t("marketplace.sell.btn_cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="marketplace-listing__bottom">
                    <span className="marketplace-listing__seller">
                      {t("marketplace.sell.total", {
                        total: listing.unitPrice * listing.quantity,
                      })}
                    </span>
                    <div className="marketplace-listing__price">
                      <div className="marketplace-listing__price-info">
                        <span className="marketplace-listing__unit-price">
                          {t("marketplace.sell.unit_price", {
                            price: listing.unitPrice,
                          })}
                        </span>
                      </div>
                      <div className="marketplace-listing__actions">
                        <button
                          className="marketplace-edit-btn"
                          onClick={() => startEdit(listing)}
                          disabled={busy}
                        >
                          {t("marketplace.sell.btn_edit")}
                        </button>
                        <button
                          className="marketplace-cancel-btn"
                          onClick={() => onCancelListing(listing.id)}
                          disabled={busy}
                        >
                          {isActioning
                            ? "..."
                            : t("marketplace.sell.btn_cancel")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
