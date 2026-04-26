import { useState, useMemo } from "react";
import {
  ProductType,
  type CreateListingData,
} from "../../services/transaction.service";
import CardDisplay from "../cards/CardDisplay";
import type { Card } from "../../services/card.service";
import "./CreateListingModal.css";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const TYPE_LABELS: Record<ProductType, string> = {
  [ProductType.CARD]: "Cartes",
  [ProductType.BOOSTER]: "Boosters",
  [ProductType.BUNDLE]: "Bundles",
};

/** Convertit un item d'inventaire en Card pour CardDisplay */
function toCard(item: any): Card {
  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity ?? "COMMON",
    type: item.type ?? "monster",
    supportType: item.supportType ?? null,
    atk: item.atk ?? 0,
    hp: item.hp ?? 0,
    cost: item.cost ?? 0,
    description: item.description ?? undefined,
    image: item.image ?? null,
    cardSet: item.cardSet ?? { id: 0, name: "" },
  };
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface CreateListingModalProps {
  isCreating: boolean;
  formProductType: ProductType;
  selectedInventoryId: number | "";
  availableItems: any[];
  selectedItem: any;
  onProductTypeChange: (type: ProductType) => void;
  onInventoryIdChange: (id: number) => void;
  onSubmit: (data: CreateListingData) => void;
  onClose: () => void;
  addToast: (message: string, type: "success" | "error" | "warning") => void;
}

// ─────────────────────────────────────────────
// 📝 COMPOSANT : CreateListingModal
// ─────────────────────────────────────────────
const CreateListingModal = ({
  isCreating,
  formProductType,
  selectedInventoryId,
  availableItems,
  selectedItem,
  onProductTypeChange,
  onInventoryIdChange,
  onSubmit,
  onClose,
  addToast,
}: CreateListingModalProps) => {
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | "">("");

  const handleSelectItem = (id: number) => {
    onInventoryIdChange(id);
    setQuantity(1);
    setUnitPrice("");
  };

  const handleTypeChange = (type: ProductType) => {
    onProductTypeChange(type);
    setSearch("");
    setQuantity(1);
    setUnitPrice("");
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return availableItems;
    return availableItems.filter((item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [availableItems, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInventoryId) {
      addToast("Veuillez sélectionner un objet.", "warning");
      return;
    }
    if (!quantity || quantity < 1) {
      addToast("La quantité doit être d'au moins 1.", "warning");
      return;
    }
    if (selectedItem && quantity > selectedItem.quantity) {
      addToast(
        `Stock insuffisant. Vous avez ${selectedItem.quantity} exemplaire(s).`,
        "warning",
      );
      return;
    }
    if (!unitPrice || unitPrice < 1) {
      addToast("Le prix doit être d'au moins 1 gold.", "warning");
      return;
    }

    onSubmit({
      productType: formProductType,
      productId: Number(selectedInventoryId),
      quantity,
      unitPrice: Number(unitPrice),
    });
  };

  return (
    <div
      className="marketplace-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="marketplace-modal-content">
        <div className="marketplace-modal-header">
          <h3>Mettre en vente</h3>
          <button
            className="marketplace-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Sélection du type ── */}
          <div className="marketplace-form-group">
            <div className="marketplace-type-selector">
              {Object.values(ProductType).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`marketplace-type-btn${formProductType === type ? " marketplace-type-btn--active" : ""}`}
                  onClick={() => handleTypeChange(type)}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Grille de sélection ── */}
          <div className="marketplace-form-group">
            <div className="marketplace-picker-header">
              <span className="marketplace-picker-count">
                {availableItems.length > 0
                  ? `${availableItems.length} ${TYPE_LABELS[formProductType].toLowerCase()} en stock`
                  : `Aucun(e) ${TYPE_LABELS[formProductType].toLowerCase()} disponible`}
              </span>
              {availableItems.length > 0 && (
                <input
                  className="marketplace-picker-search"
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </div>

            {availableItems.length === 0 ? (
              <p className="marketplace-form-hint">
                Votre inventaire est vide pour ce type d'objet.
              </p>
            ) : (
              <div
                className={
                  formProductType === ProductType.CARD
                    ? "marketplace-picker-grid marketplace-picker-grid--cards"
                    : "marketplace-picker-grid marketplace-picker-grid--items"
                }
              >
                {filteredItems.length === 0 && (
                  <p className="marketplace-form-hint">
                    Aucun résultat pour « {search} ».
                  </p>
                )}

                {formProductType === ProductType.CARD
                  ? filteredItems.map((item) => {
                      const isSelected = selectedInventoryId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`marketplace-card-pick${isSelected ? " marketplace-card-pick--selected" : ""}`}
                          onClick={() => handleSelectItem(item.id)}
                          title={`${item.name} — ×${item.quantity} en stock`}
                        >
                          <CardDisplay
                            card={toCard(item)}
                            size="sm"
                            interactive={false}
                            flippable={false}
                          />
                          <span className="marketplace-card-pick__stock">
                            ×{item.quantity}
                          </span>
                          {isSelected && (
                            <div className="marketplace-card-pick__overlay">
                              <span className="marketplace-card-pick__check">
                                ✓
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })
                  : filteredItems.map((item) => {
                      const isSelected = selectedInventoryId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`marketplace-item-pick${isSelected ? " marketplace-item-pick--selected" : ""}`}
                          onClick={() => handleSelectItem(item.id)}
                        >
                          <div className="marketplace-item-pick__icon">
                            {formProductType === ProductType.BOOSTER
                              ? "📦"
                              : "🎁"}
                          </div>
                          <span className="marketplace-item-pick__name">
                            {item.name}
                          </span>
                          <span className="marketplace-item-pick__stock">
                            ×{item.quantity}
                          </span>
                          {isSelected && (
                            <span className="marketplace-item-pick__check">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
              </div>
            )}

            {/* Récap item sélectionné */}
            {selectedItem && (
              <div className="marketplace-selected-recap">
                <strong>{selectedItem.name}</strong>
                {selectedItem.rarity && (
                  <span className="marketplace-selected-recap__tag">
                    {selectedItem.rarity}
                  </span>
                )}
                {selectedItem.cardSet?.name && (
                  <span className="marketplace-selected-recap__tag">
                    {selectedItem.cardSet.name}
                  </span>
                )}
                <span className="marketplace-selected-recap__stock">
                  {selectedItem.quantity} en stock
                </span>
              </div>
            )}
          </div>

          {/* ── Quantité + Prix — apparaît après sélection ── */}
          {selectedItem && (
            <div className="marketplace-form-row">
              <div className="marketplace-form-group">
                <label>Quantité</label>
                <div className="marketplace-qty-selector">
                  <button
                    type="button"
                    className="marketplace-qty-btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    className="marketplace-qty-input"
                    type="number"
                    min={1}
                    max={selectedItem.quantity}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(
                          selectedItem.quantity,
                          Math.max(1, Number(e.target.value)),
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="marketplace-qty-btn"
                    onClick={() =>
                      setQuantity((q) => Math.min(selectedItem.quantity, q + 1))
                    }
                    disabled={quantity >= selectedItem.quantity}
                  >
                    +
                  </button>
                  {selectedItem.quantity > 1 && (
                    <button
                      type="button"
                      className="marketplace-qty-max"
                      onClick={() => setQuantity(selectedItem.quantity)}
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              <div className="marketplace-form-group">
                <label>Prix unitaire (Gold)</label>
                <input
                  className="marketplace-price-input"
                  type="number"
                  min={1}
                  value={unitPrice}
                  onChange={(e) =>
                    setUnitPrice(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="ex. 150"
                />
                {unitPrice && quantity > 0 && (
                  <p className="marketplace-form-hint">
                    Total annonce :{" "}
                    <strong>{Number(unitPrice) * quantity} G</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="marketplace-modal-actions">
            <button type="button" onClick={onClose} disabled={isCreating}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedInventoryId || !unitPrice || isCreating}
            >
              {isCreating
                ? "Mise en vente..."
                : selectedItem && unitPrice
                  ? `Vendre ×${quantity} — ${Number(unitPrice) * quantity} G`
                  : "Vendre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;
