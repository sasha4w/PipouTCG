import { type Transaction } from "../../services/transaction.service";

// ─────────────────────────────────────────────
// 🏷️ COMPOSANT : SellTab
// ─────────────────────────────────────────────
import "./SellTab.css";
import "./ListingCard.css";

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
              {/* Badge Quantité */}
              <div className="marketplace-listing__qty">
                x{listing.quantity}
              </div>

              {/* Zone Image / Nom (Partie Haute Noire) */}
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

              {/* Zone Info / Action (Partie Basse Blanche) */}
              <div className="marketplace-listing__bottom">
                <span className="marketplace-listing__seller">
                  Prix total:{" "}
                  <strong>{listing.unitPrice * listing.quantity} G</strong>
                </span>

                <div className="marketplace-listing__price">
                  <span>{listing.unitPrice} G</span>
                  <button
                    className="marketplace-cancel-btn" /* Utilise ton style existant ou le bouton générique */
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
