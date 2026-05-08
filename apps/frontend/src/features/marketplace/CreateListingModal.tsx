import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ProductType,
  type CreateListingData,
} from "../../services/transaction.service";
import CardDisplay from "../cards/CardDisplay";
import type { Card } from "../../services/card.service";
import "./CreateListingModal.css";

const TYPE_KEYS: Record<ProductType, string> = {
  [ProductType.CARD]: "marketplace.modal.type_cards",
  [ProductType.BOOSTER]: "marketplace.modal.type_boosters",
  [ProductType.BUNDLE]: "marketplace.modal.type_bundles",
};

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
  const { t } = useTranslation();
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
      addToast(t("marketplace.modal.warn_no_item"), "warning");
      return;
    }
    if (!quantity || quantity < 1) {
      addToast(t("marketplace.modal.warn_qty"), "warning");
      return;
    }
    if (selectedItem && quantity > selectedItem.quantity) {
      addToast(
        t("marketplace.modal.warn_stock", { count: selectedItem.quantity }),
        "warning",
      );
      return;
    }
    if (!unitPrice || unitPrice < 1) {
      addToast(t("marketplace.modal.warn_price"), "warning");
      return;
    }
    onSubmit({
      productType: formProductType,
      productId: Number(selectedInventoryId),
      quantity,
      unitPrice: Number(unitPrice),
    });
  };

  const typeLabel = (type: ProductType) => t(TYPE_KEYS[type]).toLowerCase();

  return (
    <div
      className="marketplace-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="marketplace-modal-content">
        <div className="marketplace-modal-header">
          <h3>{t("marketplace.modal.title")}</h3>
          <button
            className="marketplace-modal-close"
            type="button"
            onClick={onClose}
            aria-label={t("marketplace.modal.close")}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="marketplace-form-group">
            <div className="marketplace-type-selector">
              {Object.values(ProductType).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`marketplace-type-btn${formProductType === type ? " marketplace-type-btn--active" : ""}`}
                  onClick={() => handleTypeChange(type)}
                >
                  {t(TYPE_KEYS[type])}
                </button>
              ))}
            </div>
          </div>

          <div className="marketplace-form-group">
            <div className="marketplace-picker-header">
              <span className="marketplace-picker-count">
                {availableItems.length > 0
                  ? t("marketplace.modal.stock_count", {
                      count: availableItems.length,
                      type: typeLabel(formProductType),
                    })
                  : t("marketplace.modal.stock_empty", {
                      type: typeLabel(formProductType),
                    })}
              </span>
              {availableItems.length > 0 && (
                <input
                  className="marketplace-picker-search"
                  type="text"
                  placeholder={t("marketplace.modal.search_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </div>

            {availableItems.length === 0 ? (
              <p className="marketplace-form-hint">
                {t("marketplace.modal.inventory_empty")}
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
                    {t("marketplace.modal.no_results", { search })}
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
                          title={`${item.name} — ×${item.quantity}`}
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
                  {t("marketplace.modal.in_stock", {
                    count: selectedItem.quantity,
                  })}
                </span>
              </div>
            )}
          </div>

          {selectedItem && (
            <div className="marketplace-form-row">
              <div className="marketplace-form-group">
                <label>{t("marketplace.modal.quantity")}</label>
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
                      {t("marketplace.qty.max")}
                    </button>
                  )}
                </div>
              </div>

              <div className="marketplace-form-group">
                <label>{t("marketplace.modal.unit_price")}</label>
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
                    {t("marketplace.modal.total_hint", {
                      total: Number(unitPrice) * quantity,
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="marketplace-modal-actions">
            <button type="button" onClick={onClose} disabled={isCreating}>
              {t("marketplace.modal.btn_cancel")}
            </button>
            <button
              type="submit"
              disabled={!selectedInventoryId || !unitPrice || isCreating}
            >
              {isCreating
                ? t("marketplace.modal.btn_selling")
                : selectedItem && unitPrice
                  ? t("marketplace.modal.btn_sell", {
                      qty: quantity,
                      total: Number(unitPrice) * quantity,
                    })
                  : t("marketplace.modal.btn_sell_default")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;
