import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  transactionService,
  ProductType,
  type CreateListingData,
} from "../services/transaction.service";
import { userService, type UserInventory } from "../services/user.service";
import SearchBar from "../components/Searchbar";
import FilterPanel, { useFilters } from "../components/FilterPanel";
import "./Marketplace.css";
import { QUERY_KEYS } from "../utils/querykeys";
// ─────────────────────────────────────────────
// 🔔 SYSTÈME DE TOAST
// ─────────────────────────────────────────────
type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastCounter = 0;

const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

// ─────────────────────────────────────────────
// 🔔 COMPOSANT TOAST
// ─────────────────────────────────────────────
const ToastContainer = ({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}) => {
  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <span className="toast__icon">{icons[toast.type]}</span>
          <span className="toast__message">{toast.message}</span>
          <button className="toast__close" onClick={() => onRemove(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// 🏪 PAGE MARKETPLACE
// ─────────────────────────────────────────────
const Marketplace = () => {
  const [selectedTab, setSelectedTab] = useState<"sell" | "buy">("buy");
  const [showCreateListingForm, setShowCreateListingForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formProductType, setFormProductType] = useState<ProductType>(
    ProductType.CARD,
  );
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | "">(
    "",
  );

  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  // --- QUERIES ---
  const { data: listings } = useQuery({
    queryKey: QUERY_KEYS.offers,
    queryFn: () => transactionService.findOffers(),
  });
  const { data: userListings } = useQuery({
    queryKey: QUERY_KEYS.myListings,
    queryFn: () => transactionService.findMyListings(),
  });

  const { data: inventory } = useQuery<UserInventory>({
    queryKey: QUERY_KEYS.inventory,
    queryFn: () => userService.getMyInventory(),
  });
  // --- LOGIQUE INVENTAIRE ---
  const availableItems = useMemo(() => {
    if (!inventory) return [];
    if (formProductType === ProductType.CARD) return inventory.cards.data || [];
    if (formProductType === ProductType.BOOSTER)
      return inventory.boosters.data || [];
    if (formProductType === ProductType.BUNDLE)
      return inventory.bundles.data || [];
    return [];
  }, [inventory, formProductType]);

  const selectedItem = useMemo(() => {
    return availableItems.find((item: any) => item.id === selectedInventoryId);
  }, [availableItems, selectedInventoryId]);

  // --- HANDLERS ---
  const handleCreateListing = async (data: CreateListingData) => {
    // Validation côté client
    if (!data.productId || data.productId <= 0) {
      addToast("Veuillez sélectionner un objet à vendre.", "warning");
      return;
    }
    if (!data.quantity || data.quantity <= 0) {
      addToast("La quantité doit être supérieure à 0.", "warning");
      return;
    }
    if (!data.unitPrice || data.unitPrice <= 0) {
      addToast("Le prix doit être supérieur à 0.", "warning");
      return;
    }
    if (selectedItem && data.quantity > selectedItem.quantity) {
      addToast(
        `Stock insuffisant. Vous avez seulement ${selectedItem.quantity} exemplaire(s).`,
        "warning",
      );
      return;
    }

    setIsCreating(true);
    try {
      const newListing = await transactionService.createListing(data); // ← récupère la réponse

      queryClient.setQueryData(QUERY_KEYS.myListings, (old: any) =>
        old ? { ...old, data: [newListing, ...old.data] } : old,
      );

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });

      setShowCreateListingForm(false);
      setSelectedInventoryId("");
      addToast("✨ Mise en vente réussie !", "success");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Impossible de créer l'annonce.";
      addToast(`Mise en vente impossible : ${message}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelListing = async (id: number) => {
    setLoadingAction(id);

    const snapshot = queryClient.getQueryData(QUERY_KEYS.myListings);

    queryClient.setQueryData(QUERY_KEYS.myListings, (old: any) =>
      old ? { ...old, data: old.data.filter((l: any) => l.id !== id) } : old,
    );

    try {
      await transactionService.cancel(id);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });

      addToast(
        "Annonce annulée. L'objet a été remis dans votre inventaire.",
        "success",
      );
    } catch (error: any) {
      queryClient.setQueryData(QUERY_KEYS.myListings, snapshot);

      const message =
        error.response?.data?.message || "Impossible d'annuler l'annonce.";
      addToast(message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBuyListing = async (id: number) => {
    setLoadingAction(id);
    try {
      const transaction = await transactionService.buy(id);

      queryClient.setQueryData(QUERY_KEYS.offers, (old: any) =>
        old ? { ...old, data: old.data.filter((l: any) => l.id !== id) } : old,
      );

      queryClient.setQueryData(QUERY_KEYS.profile, (old: any) =>
        old ? { ...old, gold: old.gold - transaction.totalPrice } : old,
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection });

      addToast(
        "🎉 Achat réussi ! L'objet est dans votre inventaire.",
        "success",
      );
    } catch (error: any) {
      const raw = error.response?.data?.message || "";
      let userMessage = "Achat impossible.";
      if (
        raw.toLowerCase().includes("gold") ||
        raw.toLowerCase().includes("or")
      ) {
        userMessage = "Achat impossible : vous n'avez pas assez de gold. 💰";
      } else if (
        raw.toLowerCase().includes("propre") ||
        raw.toLowerCase().includes("own")
      ) {
        userMessage =
          "Achat impossible : vous ne pouvez pas acheter votre propre annonce.";
      } else if (
        raw.toLowerCase().includes("disponible") ||
        raw.toLowerCase().includes("available")
      ) {
        userMessage = "Achat impossible : cette annonce n'est plus disponible.";
      } else if (raw) {
        userMessage = `Achat impossible : ${raw}`;
      }
      addToast(userMessage, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // --- FILTRES & RECHERCHE ---
  const filterConfig = [
    {
      key: "type",
      label: "Type",
      options: [
        { value: "all", label: "Tous" },
        { value: ProductType.CARD, label: "Cartes" },
        { value: ProductType.BOOSTER, label: "Boosters" },
        { value: ProductType.BUNDLE, label: "Bundles" },
      ],
      defaultValue: "all",
    },
  ];

  const { filterValues, setFilter, hasActiveFilters } =
    useFilters(filterConfig);

  const filteredListings = useMemo(() => {
    return listings?.data.filter((listing: any) => {
      if (
        filterValues.type !== "all" &&
        listing.productType !== filterValues.type
      )
        return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const itemName = (
          listing.card?.name ||
          listing.booster?.name ||
          listing.bundle?.name ||
          ""
        ).toLowerCase();
        const sellerName = (listing.seller?.username || "").toLowerCase();
        return itemName.includes(search) || sellerName.includes(search);
      }
      return true;
    });
  }, [listings, filterValues, searchTerm]);

  const getDisplayName = (listing: any) => {
    return (
      listing.card?.name ||
      listing.booster?.name ||
      listing.bundle?.name ||
      `Objet #${listing.productId}`
    );
  };

  // ─────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────
  return (
    <div className="marketplace-page">
      {/* Bulles décoratives */}
      <div className="marketplace-bubble marketplace-bubble--1" />
      <div className="marketplace-bubble marketplace-bubble--2" />
      <div className="marketplace-bubble marketplace-bubble--3" />

      {/* 🔔 Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Onglets */}
      <div className="marketplace-tabs">
        <button
          className={`marketplace-tab ${selectedTab === "buy" ? "marketplace-tab--active" : ""}`}
          onClick={() => setSelectedTab("buy")}
        >
          Achat
        </button>
        <button
          className={`marketplace-tab ${selectedTab === "sell" ? "marketplace-tab--active" : ""}`}
          onClick={() => setSelectedTab("sell")}
        >
          Vente
        </button>
      </div>

      {/* ── Onglet VENTE ── */}
      {selectedTab === "sell" && (
        <div className="marketplace-sell">
          <h2 className="marketplace-section__title">Mes Annonces En Cours</h2>
          <button
            className="marketplace-create-listing-btn"
            onClick={() => setShowCreateListingForm(true)}
          >
            + Créer une annonce
          </button>
          <div className="marketplace-listings">
            {userListings?.data.length === 0 ? (
              <p className="marketplace-empty">Aucune vente en cours.</p>
            ) : (
              userListings?.data.map((listing: any) => (
                <div key={listing.id} className="marketplace-listing">
                  <div className="marketplace-listing__info">
                    <span className="marketplace-listing__name">
                      <strong>{getDisplayName(listing)}</strong>
                      <span className="marketplace-listing__qty">
                        (x{listing.quantity})
                      </span>
                    </span>
                    <span className="marketplace-listing__price">
                      {listing.unitPrice} gold / u
                    </span>
                  </div>
                  <button
                    className="marketplace-cancel-btn"
                    onClick={() => handleCancelListing(listing.id)}
                    disabled={loadingAction === listing.id}
                  >
                    {loadingAction === listing.id ? "..." : "Annuler"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Onglet ACHAT ── */}
      {selectedTab === "buy" && (
        <div className="marketplace-buy">
          <h2 className="marketplace-section__title">Marché</h2>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher un objet ou un vendeur..."
            filters={
              <FilterPanel
                config={filterConfig}
                values={filterValues}
                onChange={setFilter}
              />
            }
            hasActiveFilters={hasActiveFilters}
          />
          <div className="marketplace-listings">
            {filteredListings?.length === 0 ? (
              <p className="marketplace-empty">Aucun objet trouvé.</p>
            ) : (
              filteredListings?.map((listing: any) => (
                <div key={listing.id} className="marketplace-listing">
                  <div className="marketplace-listing__info">
                    <span className="marketplace-listing__name">
                      <strong>{getDisplayName(listing)}</strong>
                      <span className="marketplace-listing__qty">
                        (x{listing.quantity})
                      </span>
                    </span>
                    <span className="marketplace-listing__seller">
                      Vendu par :{" "}
                      <strong>{listing.seller?.username || "Inconnu"}</strong>
                    </span>
                    <span className="marketplace-listing__price">
                      {listing.unitPrice} gold / u
                    </span>
                  </div>
                  <button
                    className="marketplace-buy-btn"
                    onClick={() => handleBuyListing(listing.id)}
                    disabled={loadingAction === listing.id}
                  >
                    {loadingAction === listing.id ? "..." : "Acheter"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Modal de création d'annonce ── */}
      {showCreateListingForm && (
        <div
          className="marketplace-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateListingForm(false);
          }}
        >
          <div className="marketplace-modal-content">
            <h3>Mettre en vente un objet</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const quantity = Number(formData.get("quantity"));
                const unitPrice = Number(formData.get("unitPrice"));

                // Validations avant soumission
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

                handleCreateListing({
                  productType: formProductType,
                  productId: Number(selectedInventoryId),
                  quantity,
                  unitPrice,
                });
              }}
            >
              <div className="marketplace-form-group">
                <label>Type d'objet</label>
                <select
                  value={formProductType}
                  onChange={(e) => {
                    setFormProductType(e.target.value as ProductType);
                    setSelectedInventoryId("");
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
                  onChange={(e) =>
                    setSelectedInventoryId(Number(e.target.value))
                  }
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
                <button
                  type="button"
                  onClick={() => setShowCreateListingForm(false)}
                  disabled={isCreating}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!selectedInventoryId || isCreating}
                >
                  {isCreating ? "Mise en vente..." : "Vendre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
