import { type Transaction } from "../../services/transaction.service";
import "./SellTab.css";
import "./ListingCard.css";

// ─────────────────────────────────────────────
// 🏷️ COMPOSANT : SellTab
// ─────────────────────────────────────────────
interface SellTabProps {
  userListings: Transaction[] | undefined;
  loadingAction: number | null;
  getDisplayName: (listing: Transaction) => string;
  onCreateListing: () => void;
  onCancelListing: (id: number) => void;
}

const SellTab = ({
  userListings,
  loadingAction,
  getDisplayName,
  onCreateListing,
  onCancelListing,
}: SellTabProps) => {
  return (
    <div className="marketplace-sell">
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
          userListings?.map((listing: Transaction) => (
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
                <div className="marketplace-listing__qty">
                  ×{listing.quantity}
                </div>
              </div>

              {/* Zone Info / Action */}
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
                  <button
                    className="marketplace-cancel-btn"
                    onClick={() => onCancelListing(listing.id)}
                    disabled={loadingAction === listing.id}
                  >
                    {loadingAction === listing.id ? "..." : "Annuler"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SellTab;
