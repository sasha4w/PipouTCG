import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../../../stores";

describe("UIStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      activeTab: "fight",
      isCardPickModalOpen: false,
      isSettingsOpen: false,
      isConfirmDialogOpen: false,
      toast: null,
      marketplaceFilters: {},
      deckSearchTerm: "",
      isLoadingMatch: false,
      isLoadingCards: false,
    });
  });

  it("should initialize with default values", () => {
    const state = useUIStore.getState();
    expect(state.activeTab).toBe("fight");
    expect(state.isCardPickModalOpen).toBe(false);
    expect(state.isSettingsOpen).toBe(false);
    expect(state.toast).toBeNull();
  });

  it("should set active tab", () => {
    const { setActiveTab } = useUIStore.getState();
    setActiveTab("history");
    expect(useUIStore.getState().activeTab).toBe("history");

    setActiveTab("leaderboard");
    expect(useUIStore.getState().activeTab).toBe("leaderboard");
  });

  it("should open and close card pick modal", () => {
    const { openCardPickModal, closeCardPickModal } = useUIStore.getState();
    expect(useUIStore.getState().isCardPickModalOpen).toBe(false);

    openCardPickModal();
    expect(useUIStore.getState().isCardPickModalOpen).toBe(true);

    closeCardPickModal();
    expect(useUIStore.getState().isCardPickModalOpen).toBe(false);
  });

  it("should open and close settings", () => {
    const { openSettings, closeSettings } = useUIStore.getState();
    openSettings();
    expect(useUIStore.getState().isSettingsOpen).toBe(true);

    closeSettings();
    expect(useUIStore.getState().isSettingsOpen).toBe(false);
  });

  it("should open and close confirm dialog", () => {
    const { openConfirmDialog, closeConfirmDialog } = useUIStore.getState();
    openConfirmDialog();
    expect(useUIStore.getState().isConfirmDialogOpen).toBe(true);

    closeConfirmDialog();
    expect(useUIStore.getState().isConfirmDialogOpen).toBe(false);
  });

  it("should show and dismiss toast", () => {
    const { showToast, dismissToast } = useUIStore.getState();
    expect(useUIStore.getState().toast).toBeNull();

    showToast("Success!", "ok");
    let state = useUIStore.getState();
    expect(state.toast).not.toBeNull();
    expect(state.toast?.msg).toBe("Success!");
    expect(state.toast?.type).toBe("ok");

    showToast("Error occurred", "err");
    state = useUIStore.getState();
    expect(state.toast?.msg).toBe("Error occurred");
    expect(state.toast?.type).toBe("err");

    dismissToast();
    expect(useUIStore.getState().toast).toBeNull();
  });

  it("should set marketplace filters", () => {
    const { setMarketplaceFilters } = useUIStore.getState();
    setMarketplaceFilters({ rarity: "rare", minPrice: 100 });

    const state = useUIStore.getState();
    expect(state.marketplaceFilters.rarity).toBe("rare");
    expect(state.marketplaceFilters.minPrice).toBe(100);
  });

  it("should clear marketplace filters", () => {
    const state = useUIStore.getState();
    state.setMarketplaceFilters({ rarity: "epic" });
    expect(useUIStore.getState().marketplaceFilters.rarity).toBe("epic");

    state.clearMarketplaceFilters();
    expect(useUIStore.getState().marketplaceFilters).toEqual({});
  });

  it("should set deck search term", () => {
    const { setDeckSearchTerm } = useUIStore.getState();
    setDeckSearchTerm("Aggro");
    expect(useUIStore.getState().deckSearchTerm).toBe("Aggro");

    setDeckSearchTerm("");
    expect(useUIStore.getState().deckSearchTerm).toBe("");
  });

  it("should set loading states", () => {
    const { setLoadingMatch, setLoadingCards } = useUIStore.getState();

    setLoadingMatch(true);
    expect(useUIStore.getState().isLoadingMatch).toBe(true);

    setLoadingCards(true);
    expect(useUIStore.getState().isLoadingCards).toBe(true);

    setLoadingMatch(false);
    setLoadingCards(false);
    expect(useUIStore.getState().isLoadingMatch).toBe(false);
    expect(useUIStore.getState().isLoadingCards).toBe(false);
  });

  it("should reset to initial state", () => {
    const state = useUIStore.getState();
    state.setActiveTab("rules");
    state.openSettings();
    state.showToast("Test", "ok");
    state.setDeckSearchTerm("Test Deck");

    state.reset();

    const resetState = useUIStore.getState();
    expect(resetState.activeTab).toBe("fight");
    expect(resetState.isSettingsOpen).toBe(false);
    expect(resetState.toast).toBeNull();
    expect(resetState.deckSearchTerm).toBe("");
  });
});
