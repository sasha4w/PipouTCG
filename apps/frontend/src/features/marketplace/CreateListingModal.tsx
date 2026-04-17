import {
  ProductType,
  type CreateListingData,
} from "../../services/transaction.service";
import "./CreateListingModal.css";
// ─────────────────────────────────────────────
// 📝 COMPOSANT : CreateListingModal
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
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get("quantity"));
    const unitPrice = Number(formData.get("unitPrice"));

    if (!selectedInventoryId) {
      addToast("Veuillez sélectionner un objet.", "warning");
      return;
    }
    if (!quantity || quantity < 1) {
      addToast("La quantité doit être d'au moins 1.", "warning");
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
      unitPrice,
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
        <h3>Mettre en vente un objet</h3>
        <form onSubmit={handleSubmit}>
          <div className="marketplace-form-group">
            <label>Type d'objet</label>
            <select
              value={formProductType}
              onChange={(e) => {
                onProductTypeChange(e.target.value as ProductType);
              }}
              required
            >
              {Object.values(ProductType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="marketplace-form-group">
            <label>Sélectionner l'objet</label>
            <select
              name="productId"
              value={selectedInventoryId}
              onChange={(e) => onInventoryIdChange(Number(e.target.value))}
              required
            >
              <option value="">-- Choisir --</option>
              {availableItems.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Stock : {item.quantity})
                </option>
              ))}
            </select>
            {availableItems.length === 0 && (
              <p className="marketplace-form-hint">
                Aucun {formProductType.toLowerCase()} dans votre inventaire.
              </p>
            )}
          </div>

          <div className="marketplace-form-group">
            <label>Quantité</label>
            <input
              type="number"
              name="quantity"
              min="1"
              max={selectedItem?.quantity || 1}
              defaultValue="1"
              required
            />
            {selectedItem && (
              <p className="marketplace-form-hint">
                Max disponible : {selectedItem.quantity}
              </p>
            )}
          </div>

          <div className="marketplace-form-group">
            <label>Prix unitaire (Gold)</label>
            <input type="number" name="unitPrice" min="1" required />
          </div>

          <div className="marketplace-modal-actions">
            <button type="button" onClick={onClose} disabled={isCreating}>
              Annuler
            </button>
            <button type="submit" disabled={!selectedInventoryId || isCreating}>
              {isCreating ? "Mise en vente..." : "Vendre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;
