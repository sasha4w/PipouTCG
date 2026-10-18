import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AchievementProgress, AchievementsResponse, UserQuest, UserQuestsResponse } from "@pipou/shared";
import i18n from "../../i18n";
import QuestsPanel from "../../features/profile/QuestsPanel";

const quest = (id: number, extra: Partial<UserQuest> = {}): UserQuest => ({
  id,
  questId: id,
  title: "quests.pool.d_open_1",
  description: null,
  resetType: "DAILY",
  rewardType: "GOLD",
  rewardAmount: 100,
  rewardItemId: null,
  progress: {
    operator: "AND",
    conditions: [{ type: "OPEN_BOOSTER", current: 0, target: 1, completed: false }],
    globalCompleted: false,
  },
  isCompleted: false,
  rewardClaimed: false,
  resetAt: new Date(Date.now() + 3_600_000).toISOString(),
  ...extra,
});

let quests: UserQuestsResponse;
let achievements: AchievementsResponse = { families: [], unlocked: 4, total: 36, equippedTitle: null };
vi.mock("../../hooks/useGameData", () => ({
  useQuests: () => ({ data: quests, isLoading: false }),
  useClaimReward: () => ({ mutate: vi.fn(), isPending: false }),
  useRerollQuest: () => ({ mutate: vi.fn(), isPending: false }),
  useAchievements: () => ({ data: achievements, isLoading: false, isError: false }),
  useClaimAchievement: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTitle: () => ({ mutate: vi.fn(), isPending: false }),
}));

const queryClient = new QueryClient();
const renderPanel = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <QuestsPanel />
    </QueryClientProvider>,
  );

const claimableFamily = (): AchievementProgress => ({
  family: "DUELS_WON",
  value: 5,
  claimedTier: null,
  tiers: (["BRONZE", "SILVER", "GOLD"] as const).map((tier, i) => ({
    tier,
    threshold: [1, 25, 100][i],
    reward: { type: "GOLD", amount: 100 },
    claimed: false,
    reached: i === 0,
  })),
});

const base = (): UserQuestsResponse => ({
  DAILY: [quest(1), quest(2, { isCompleted: true })],
  WEEKLY: [],
  MONTHLY: [],
  EVENT: [],
  rerollAvailable: true,
  dailyResetAt: new Date(Date.now() + 3_600_000).toISOString(),
  weeklyResetAt: new Date(Date.now() + 86_400_000).toISOString(),
});

describe("QuestsPanel", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche Daily, Hebdo et Succès avec le compteur, mais pas Mensuel vide", () => {
    quests = base();
    renderPanel();
    expect(screen.getByRole("button", { name: /Daily/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hebdo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Succès 4\/36/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Monthly/ })).not.toBeInTheDocument();
  });

  it("traduit le titre des quêtes du pool", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByText("Ouvre 1 booster")).toHaveLength(2);
  });

  it("propose la relance seulement sur les quêtes non terminées", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByRole("button", { name: "Changer cette quête" })).toHaveLength(1);
  });

  it("masque la relance quand elle est utilisée", () => {
    quests = { ...base(), rerollAvailable: false };
    renderPanel();
    expect(screen.queryByRole("button", { name: "Changer cette quête" })).not.toBeInTheDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
    achievements = { families: [], unlocked: 4, total: 36, equippedTitle: null };
  });

  it("affiche un compte à rebours sans doublon « restantes »", () => {
    quests = base();
    renderPanel();
    const header = screen.getByText(/^Reset dans /);
    expect(header.textContent).toMatch(/^Reset dans \d+(h \d+min|min \d+s)$/);
    expect(header.textContent).not.toMatch(/restantes/);
  });

  it("invalide les quêtes une seule fois quand le compte à rebours atteint 0", () => {
    vi.useFakeTimers();
    quests = { ...base(), dailyResetAt: new Date(Date.now() + 2_000).toISOString() };
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderPanel();
    expect(spy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("montre la cloche sur l'onglet Succès quand un palier est réclamable", () => {
    quests = base();
    achievements = { families: [claimableFamily()], unlocked: 0, total: 36, equippedTitle: null };
    renderPanel();
    expect(screen.getByRole("button", { name: /Succès/ }).querySelector("svg")).not.toBeNull();
  });
});
