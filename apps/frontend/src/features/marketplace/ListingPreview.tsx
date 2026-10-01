import CardDisplay from "../cards/CardDisplay";
import type { Transaction } from "../../services/transaction.service";

interface ListingPreviewProps {
  listing: Transaction;
  name: string;
}

/** Haut d'une annonce : la carte vendue si c'en est une, sinon une icône + le nom. */
export default function ListingPreview({ listing, name }: ListingPreviewProps) {
  return (
    <div
      className={`marketplace-listing__top${listing.card ? " marketplace-listing__top--card" : ""}`}
    >
      {listing.card ? (
        <div className="marketplace-listing__card-preview">
          <CardDisplay
            card={listing.card}
            size="sm"
            interactive={false}
            flippable={false}
          />
        </div>
      ) : (
        <>
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7a1c3b"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M20.4 14.5L16 10 4 20" />
          </svg>
          <div className="marketplace-listing__name">{name}</div>
        </>
      )}
      <div className="marketplace-listing__qty">×{listing.quantity}</div>
    </div>
  );
}
