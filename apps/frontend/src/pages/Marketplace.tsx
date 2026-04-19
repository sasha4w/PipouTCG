import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  transactionService,
  ProductType,
  type Transaction,
  type CreateListingData,
} from "../services/transaction.service";
import { userService, type UserInventory } from "../services/user.service";
import { useFilters } from "../components/FilterPanel";
import "./Marketplace.css";
import { QUERY_KEYS } from "../utils/querykeys";
import { useToast, ToastContainer } from "../hooks/useToast";
import { useSseNewListings } from "../hooks/useSseNotifications";
import MarketplaceTabs from "../features/marketplace/MarketplaceTabs";
import SellTab from "../features/marketplace/SellTab";
import BuyTab from "../features/marketplace/BuyTab";
import CreateListingModal from "../features/marketplace/CreateListingModal";

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

  // ── SSE : tout le monde voit les nouvelles annonces et annulations ──
  useSseNewListings(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
  });

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

  // --- HELPERS ---
  const getDisplayName = (listing: Transaction) =>
    listing.itemName || `Objet #${listing.productId}`;

  // --- HANDLERS ---
  const handleCreateListing = async (data: CreateListingData) => {
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
      const newListing = await transactionService.createListing(data);

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
      // ✅ Invalide toutes les données impactées par l'achat
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });

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
    return listings?.data.filter((listing: Transaction) => {
      if (
        filterValues.type !== "all" &&
        listing.productType !== filterValues.type
      )
        return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const itemName = (listing.itemName || "").toLowerCase();
        const sellerName = (listing.seller?.username || "").toLowerCase();
        return itemName.includes(search) || sellerName.includes(search);
      }
      return true;
    });
  }, [listings, filterValues, searchTerm]);

  // ─────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────
  return (
    <div className="marketplace-page">
      <div className="marketplace-bubble marketplace-bubble--1" />
      <div className="marketplace-bubble marketplace-bubble--2" />
      <div className="marketplace-bubble marketplace-bubble--3" />

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <MarketplaceTabs selectedTab={selectedTab} onTabChange={setSelectedTab} />

      {selectedTab === "sell" && (
        <SellTab
          userListings={userListings?.data}
          loadingAction={loadingAction}
          getDisplayName={getDisplayName}
          onCreateListing={() => setShowCreateListingForm(true)}
          onCancelListing={handleCancelListing}
        />
      )}

      {selectedTab === "buy" && (
        <BuyTab
          filteredListings={filteredListings}
          loadingAction={loadingAction}
          searchTerm={searchTerm}
          filterConfig={filterConfig}
          filterValues={filterValues}
          hasActiveFilters={hasActiveFilters}
          getDisplayName={getDisplayName}
          onSearchChange={setSearchTerm}
          onFilterChange={setFilter}
          onBuyListing={handleBuyListing}
        />
      )}

      {showCreateListingForm && (
        <CreateListingModal
          isCreating={isCreating}
          formProductType={formProductType}
          selectedInventoryId={selectedInventoryId}
          availableItems={availableItems}
          selectedItem={selectedItem}
          onProductTypeChange={(type) => {
            setFormProductType(type);
            setSelectedInventoryId("");
          }}
          onInventoryIdChange={setSelectedInventoryId}
          onSubmit={handleCreateListing}
          onClose={() => setShowCreateListingForm(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default Marketplace;
