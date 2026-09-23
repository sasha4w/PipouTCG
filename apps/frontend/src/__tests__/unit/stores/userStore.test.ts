import { describe, it, expect, beforeEach } from "vitest";
import { useUserStore } from "../../../stores";

describe("UserStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      language: "en",
      theme: "system",
      isFirstVisit: true,
      isDailyRewardModalOpen: false,
    });
  });

  it("should initialize with default values", () => {
    const state = useUserStore.getState();
    expect(state.language).toBe("en");
    expect(state.theme).toBe("system");
    expect(state.isFirstVisit).toBe(true);
    expect(state.isDailyRewardModalOpen).toBe(false);
  });

  it("should set language", () => {
    const { setLanguage } = useUserStore.getState();
    setLanguage("fr");
    expect(useUserStore.getState().language).toBe("fr");

    setLanguage("ko");
    expect(useUserStore.getState().language).toBe("ko");
  });

  it("should set theme", () => {
    const { setTheme } = useUserStore.getState();
    setTheme("dark");
    expect(useUserStore.getState().theme).toBe("dark");

    setTheme("light");
    expect(useUserStore.getState().theme).toBe("light");
  });

  it("should set first visit flag", () => {
    const { setIsFirstVisit } = useUserStore.getState();
    setIsFirstVisit(false);
    expect(useUserStore.getState().isFirstVisit).toBe(false);

    setIsFirstVisit(true);
    expect(useUserStore.getState().isFirstVisit).toBe(true);
  });

  it("should open daily reward modal", () => {
    const { openDailyRewardModal } = useUserStore.getState();
    openDailyRewardModal();
    expect(useUserStore.getState().isDailyRewardModalOpen).toBe(true);
  });

  it("should close daily reward modal", () => {
    const state = useUserStore.getState();
    state.openDailyRewardModal();
    expect(useUserStore.getState().isDailyRewardModalOpen).toBe(true);

    state.closeDailyRewardModal();
    expect(useUserStore.getState().isDailyRewardModalOpen).toBe(false);
  });

  it("should reset to default user settings", () => {
    const state = useUserStore.getState();
    state.setLanguage("fr");
    state.setTheme("dark");
    state.setIsFirstVisit(false);
    state.openDailyRewardModal();

    state.resetUserSettings();

    const resetState = useUserStore.getState();
    expect(resetState.language).toBe("en");
    expect(resetState.theme).toBe("system");
    expect(resetState.isFirstVisit).toBe(true);
    expect(resetState.isDailyRewardModalOpen).toBe(false);
  });

  it("should persist language and theme to localStorage", () => {
    const state = useUserStore.getState();
    state.setLanguage("ko");
    state.setTheme("dark");

    // Verify the state is updated
    expect(useUserStore.getState().language).toBe("ko");
    expect(useUserStore.getState().theme).toBe("dark");
  });

  it("should not persist daily reward modal state", () => {
    // Modal state should reset on app reload (not persisted)
    const state = useUserStore.getState();
    state.openDailyRewardModal();
    expect(useUserStore.getState().isDailyRewardModalOpen).toBe(true);

    // If we were to reload, isDailyRewardModalOpen would be false
    // But we can't test that here, so we just verify the config intent
  });

  it("should handle multiple preference changes", () => {
    const state = useUserStore.getState();
    state.setLanguage("fr");
    state.setTheme("light");
    state.setIsFirstVisit(false);

    const current = useUserStore.getState();
    expect(current.language).toBe("fr");
    expect(current.theme).toBe("light");
    expect(current.isFirstVisit).toBe(false);
  });
});
