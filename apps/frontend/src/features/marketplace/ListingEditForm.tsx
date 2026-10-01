import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type {
  Transaction,
  UpdateListingData,
} from "../../services/transaction.service";
import "./ListingEditForm.css";

interface ListingEditFormProps {
  listing: Transaction;
  name: string;
  /** Quantité en vente + stock encore en inventaire. */
  maxQuantity: number;
  busy: boolean;
  onSubmit: (data: UpdateListingData) => void;
  onCancel: () => void;
}

const isPositiveInt = (n: number) => Number.isInteger(n) && n >= 1;

/**
 * Formulaire d'édition d'une annonce. Les champs sont gardés en chaînes pour
 * qu'on puisse les vider pendant la saisie ; seuls les champs modifiés sont envoyés.
 */
export default function ListingEditForm({
  listing,
  name,
  maxQuantity,
  busy,
  onSubmit,
  onCancel,
}: ListingEditFormProps) {
  const { t } = useTranslation();
  // Le prix peut arriver en chaîne (BIGINT) : on normalise en nombre.
  const initialQuantity = Number(listing.quantity);
  const initialPrice = Number(listing.unitPrice);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [unitPrice, setUnitPrice] = useState(String(initialPrice));

  const qty = Number(quantity);
  const price = Number(unitPrice);
  const qtyValid = isPositiveInt(qty) && qty <= maxQuantity;
  const priceValid = isPositiveInt(price);
  const total = (qtyValid ? qty : 0) * (priceValid ? price : 0);

  const clampQty = (n: number) =>
    setQuantity(String(Math.min(Math.max(1, n), maxQuantity)));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!qtyValid || !priceValid) return;
    const data: UpdateListingData = {
      ...(qty !== initialQuantity && { quantity: qty }),
      ...(price !== initialPrice && { unitPrice: price }),
    };
    if (Object.keys(data).length === 0) onCancel();
    else onSubmit(data);
  };

  const qtyId = `listing-${listing.id}-qty`;
  const priceId = `listing-${listing.id}-price`;

  return (
    <form
      className="marketplace-listing marketplace-listing--editing"
      onSubmit={handleSubmit}
    >
      <header className="listing-edit__header">
        <span className="listing-edit__eyebrow">
          {t("marketplace.sell.edit_title")}
        </span>
        <h3 className="listing-edit__name">{name}</h3>
      </header>

      <div className="listing-edit__field">
        <label className="listing-edit__label" htmlFor={qtyId}>
          {t("marketplace.sell.edit_quantity")}
        </label>
        <div className="listing-edit__stepper">
          <button
            type="button"
            className="listing-edit__step"
            onClick={() => clampQty((qtyValid ? qty : 1) - 1)}
            disabled={busy || qty <= 1}
            aria-label={t("marketplace.qty.reduce")}
          >
            −
          </button>
          <input
            id={qtyId}
            className="listing-edit__input listing-edit__input--qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={!qtyValid}
            disabled={busy}
          />
          <button
            type="button"
            className="listing-edit__step"
            onClick={() => clampQty((qtyValid ? qty : 0) + 1)}
            disabled={busy || qty >= maxQuantity}
            aria-label={t("marketplace.qty.increase")}
          >
            +
          </button>
          <button
            type="button"
            className="listing-edit__max"
            onClick={() => clampQty(maxQuantity)}
            disabled={busy || qty === maxQuantity}
          >
            {t("marketplace.qty.max")}
          </button>
        </div>
        <span className="listing-edit__hint">
          {t("marketplace.sell.edit_max", { max: maxQuantity })}
        </span>
      </div>

      <div className="listing-edit__field">
        <label className="listing-edit__label" htmlFor={priceId}>
          {t("marketplace.sell.edit_price")}
        </label>
        <div className="listing-edit__price">
          <input
            id={priceId}
            className="listing-edit__input"
            type="number"
            inputMode="numeric"
            min={1}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            aria-invalid={!priceValid}
            disabled={busy}
          />
          <span className="listing-edit__suffix">G</span>
        </div>
      </div>

      <p className="listing-edit__total">
        {t("marketplace.sell.edit_total", { total })}
      </p>

      <div className="listing-edit__actions">
        <button
          type="submit"
          className="listing-edit__save"
          disabled={busy || !qtyValid || !priceValid}
        >
          {busy ? "..." : t("marketplace.sell.btn_save")}
        </button>
        <button
          type="button"
          className="marketplace-cancel-btn"
          onClick={onCancel}
          disabled={busy}
        >
          {t("marketplace.sell.btn_cancel")}
        </button>
      </div>
    </form>
  );
}
