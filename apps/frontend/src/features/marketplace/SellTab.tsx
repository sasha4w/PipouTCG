import { useState } from "react";
import {
  type Transaction,
  type UpdateListingData,
} from "../../services/transaction.service";
import TransactionHistory from "./TransactionHistory";
import "./SellTab.css";
import "./ListingCard.css";

// ─────────────────────────────────────────────
// 🏷️ COMPOSANT : SellTab
// ─────────────────────────────────────────────
interface SellTabProps {
  userListings: Transaction[] | undefined;
  userSellHistory: Transaction[] | undefined; // historique ventes COMPLETED de l'user
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    quantity: 1,
    unitPrice: 1,
  });

  const startEdit = (listing: Transaction) => {
    setEditingId(listing.id);
    setEditForm({ quantity: listing.quantity, unitPrice: listing.unitPrice });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const submitEdit = (id: number) => {
    onUpdateListing(id, {
      quantity: editForm.quantity,
      unitPrice: editForm.unitPrice,
    });
    setEditingId(null);
  };

  return (
    <div className="marketplace-sell">
      {/* ── Annonces actives ── */}
      <h2 className="marketplace-section__title">Mes Annonces En Cours</h2>
      <div className="marketplace-header-actions">
        <button
          className="marketplace-create-listing-btn"
          onClick={onCreateListing}
        >
          + Créer une annonce
        </button>
      </div>
      <div className="marketplace-listings">
        {userListings?.length === 0 ? (
          <p className="marketplace-empty">Aucune vente en cours.</p>
        ) : (
          userListings?.map((listing: Transaction) => {
            const isEditing = editingId === listing.id;
            const isActioning = loadingAction === listing.id;
            const isUpdating = loadingUpdate === listing.id;
            const busy = isActioning || isUpdating;

            return (
              <div key={listing.id} className="marketplace-listing">
                {/* Zone Image / Nom + Badge quantité */}
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

                {/* ── Mode édition ── */}
                {isEditing ? (
                  <div className="marketplace-listing__edit-form">
                    <label className="marketplace-listing__edit-label">
                      Quantité
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
                      Prix unitaire (G)
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
                      Total estimé :{" "}
                      <strong>
                        {editForm.quantity * editForm.unitPrice} G
                      </strong>
                    </div>
                    <div className="marketplace-listing__edit-actions">
                      <button
                        className="marketplace-save-btn"
                        onClick={() => submitEdit(listing.id)}
                        disabled={busy}
                      >
                        {isUpdating ? "..." : "Sauvegarder"}
                      </button>
                      <button
                        className="marketplace-cancel-btn"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Mode affichage ── */
                  <div className="marketplace-listing__bottom">
                    <span className="marketplace-listing__seller">
                      Total :{" "}
                      <strong>{listing.unitPrice * listing.quantity} G</strong>
                    </span>
                    <div className="marketplace-listing__price">
                      <div className="marketplace-listing__price-info">
                        <span className="marketplace-listing__unit-price">
                          {listing.unitPrice} G / u
                        </span>
                      </div>
                      <div className="marketplace-listing__actions">
                        <button
                          className="marketplace-edit-btn"
                          onClick={() => startEdit(listing)}
                          disabled={busy}
                        >
                          Modifier
                        </button>
                        <button
                          className="marketplace-cancel-btn"
                          onClick={() => onCancelListing(listing.id)}
                          disabled={busy}
                        >
                          {isActioning ? "..." : "Annuler"}
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

      {/* ── Historique ventes ── */}
      <h2 className="marketplace-section__title marketplace-section__title--history">
        Mes Ventes Récentes
      </h2>
      <TransactionHistory
        history={userSellHistory}
        emptyMessage="Aucune vente complétée."
      />
    </div>
  );
};

export default SellTab;
