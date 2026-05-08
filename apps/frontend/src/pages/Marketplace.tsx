import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  transactionService,
  ProductType,
  type Transaction,
  type CreateListingData,
  type UpdateListingData,
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

const Marketplace = () => {
  const { t } = useTranslation();

  const [selectedTab, setSelectedTab] = useState<"sell" | "buy">("buy");
  const [showCreateListingForm, setShowCreateListingForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [loadingUpdate, setLoadingUpdate] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formProductType, setFormProductType] = useState<ProductType>(
    ProductType.CARD,
  );
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | "">(
    "",
  );

  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  useSseNewListings(
    (event?: {
      type?: string;
      transactionId?: number;
      newQuantity?: number;
    }) => {
      if (event?.type === "listing.updated" && event.transactionId != null) {
        queryClient.setQueryData(QUERY_KEYS.offers, (old: any) =>
          old
            ? {
                ...old,
                data: old.data.map((l: any) =>
                  l.id === event.transactionId
                    ? { ...l, quantity: event.newQuantity }
                    : l,
                ),
              }
            : old,
        );
      } else {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      }
    },
  );

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

  const { data: recentSalesData } = useQuery({
    queryKey: ["transactions", "recent-sales"],
    queryFn: () => transactionService.getRecentSales(),
  });

  const { data: mySalesData } = useQuery({
    queryKey: ["transactions", "history", "seller"],
    queryFn: () => transactionService.getHistory(1, 20, "seller"),
  });

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

  const getDisplayName = (listing: Transaction) =>
    listing.itemName || `Objet #${listing.productId}`;

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const handleCreateListing = async (data: CreateListingData) => {
    if (!data.productId || data.productId <= 0) {
      addToast(t("marketplace.toast.warn_no_item"), "warning");
      return;
    }
    if (!data.quantity || data.quantity <= 0) {
      addToast(t("marketplace.toast.warn_qty"), "warning");
      return;
    }
    if (!data.unitPrice || data.unitPrice <= 0) {
      addToast(t("marketplace.toast.warn_price"), "warning");
      return;
    }
    if (selectedItem && data.quantity > selectedItem.quantity) {
      addToast(
        t("marketplace.toast.warn_stock", { count: selectedItem.quantity }),
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
      addToast(t("marketplace.toast.sell_success"), "success");
    } catch (error: any) {
      const message = error.response?.data?.message || "";
      addToast(
        message
          ? t("marketplace.toast.sell_error", { message })
          : t("marketplace.toast.sell_error", {
              message: t("marketplace.toast.buy_error_default"),
            }),
        "error",
      );
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
      addToast(t("marketplace.toast.cancel_success"), "success");
    } catch (error: any) {
      queryClient.setQueryData(QUERY_KEYS.myListings, snapshot);
      addToast(t("marketplace.toast.cancel_error"), "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateListing = async (id: number, data: UpdateListingData) => {
    if (
      (data.quantity !== undefined && data.quantity < 1) ||
      (data.unitPrice !== undefined && data.unitPrice < 1)
    ) {
      addToast(t("marketplace.toast.update_warn"), "warning");
      return;
    }
    setLoadingUpdate(id);
    const snapshot = queryClient.getQueryData(QUERY_KEYS.myListings);
    queryClient.setQueryData(QUERY_KEYS.myListings, (old: any) =>
      old
        ? {
            ...old,
            data: old.data.map((l: any) =>
              l.id === id
                ? {
                    ...l,
                    ...(data.quantity !== undefined && {
                      quantity: data.quantity,
                    }),
                    ...(data.unitPrice !== undefined && {
                      unitPrice: data.unitPrice,
                      totalPrice:
                        data.unitPrice * (data.quantity ?? l.quantity),
                    }),
                  }
                : l,
            ),
          }
        : old,
    );
    try {
      const updated = await transactionService.updateListing(id, data);
      queryClient.setQueryData(QUERY_KEYS.myListings, (old: any) =>
        old
          ? {
              ...old,
              data: old.data.map((l: any) => (l.id === id ? updated : l)),
            }
          : old,
      );
      addToast(t("marketplace.toast.update_success"), "success");
    } catch (error: any) {
      queryClient.setQueryData(QUERY_KEYS.myListings, snapshot);
      addToast(t("marketplace.toast.update_error"), "error");
    } finally {
      setLoadingUpdate(null);
    }
  };

  const handleBuyListing = async (id: number, quantity: number) => {
    setLoadingAction(id);
    try {
      const transaction = await transactionService.buy(id, quantity);
      queryClient.setQueryData(QUERY_KEYS.profile, (old: any) =>
        old ? { ...old, gold: old.gold - transaction.totalPrice } : old,
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "recent-sales"],
      });
      addToast(t("marketplace.toast.buy_success"), "success");
    } catch (error: any) {
      const raw = error.response?.data?.message || "";
      let userMessage = t("marketplace.toast.buy_error_default");
      if (
        raw.toLowerCase().includes("gold") ||
        raw.toLowerCase().includes("or")
      )
        userMessage = t("marketplace.toast.buy_no_gold");
      else if (
        raw.toLowerCase().includes("propre") ||
        raw.toLowerCase().includes("own")
      )
        userMessage = t("marketplace.toast.buy_own");
      else if (
        raw.toLowerCase().includes("disponible") ||
        raw.toLowerCase().includes("available")
      )
        userMessage = t("marketplace.toast.buy_unavailable");
      else if (raw)
        userMessage = t("marketplace.toast.buy_error", { message: raw });
      addToast(userMessage, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // ─────────────────────────────────────────────
  // Filtres BuyTab
  // ─────────────────────────────────────────────

  const filterConfig = [
    {
      key: "type",
      label: t("filter.type"),
      options: [
        { value: "all", label: t("marketplace.filter.all") },
        { value: ProductType.CARD, label: t("marketplace.filter.cards") },
        { value: ProductType.BOOSTER, label: t("marketplace.filter.boosters") },
        { value: ProductType.BUNDLE, label: t("marketplace.filter.bundles") },
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
          userSellHistory={mySalesData?.data}
          loadingAction={loadingAction}
          loadingUpdate={loadingUpdate}
          getDisplayName={getDisplayName}
          onCreateListing={() => setShowCreateListingForm(true)}
          onCancelListing={handleCancelListing}
          onUpdateListing={handleUpdateListing}
        />
      )}

      {selectedTab === "buy" && (
        <BuyTab
          filteredListings={filteredListings}
          buyHistory={recentSalesData?.data}
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
